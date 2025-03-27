from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import logging
from sqlalchemy import text
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from the .env file
load_dotenv(override=True)

# Get the database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is not set")
    raise ValueError("DATABASE_URL environment variable is not set")

# Ensure proper format for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

logger.info(f"Connecting to database with URL: {DATABASE_URL}")

app = Flask(__name__, static_folder='static', static_url_path='')

# Configure CORS with more permissive settings
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Configure the database
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'poolclass': QueuePool,
    'pool_size': 1,
    'max_overflow': 1,
    'pool_timeout': 10,
    'pool_recycle': 1800,
    'connect_args': {
        'sslmode': 'require',
        'connect_timeout': 10
    }
}

# Initialize database
db = SQLAlchemy(app)

# Database Models
class Judge(db.Model):
    __tablename__ = 'judges'
    id = db.Column(db.Integer, primary_key=True)
    judge_name = db.Column(db.String(80), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    judge = db.Column(db.String(80), nullable=False, index=True)
    team = db.Column(db.String(80), nullable=False, index=True)
    score = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    __table_args__ = (
        db.UniqueConstraint('judge', 'team', name='unique_judge_team'),
    )

    def __init__(self, judge, team, score=None):
        self.judge = judge
        self.team = team
        self.score = score
        self.timestamp = None

# Initialize database tables
def init_db():
    try:
        with app.app_context():
            # Test the connection first with timeout
            logger.info("Testing database connection...")
            db.session.execute(text("SELECT 1"))
            db.session.commit()
            logger.info("Database connection successful")
            
            # Create tables
            logger.info("Creating database tables...")
            db.create_all()
            logger.info("Database tables created successfully")
            
            # Verify tables exist
            result = db.session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = [row[0] for row in result]
            logger.info(f"Available tables: {tables}")
            
    except SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e.__dict__)}")
        raise
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e.__dict__)}")
        raise

# Initialize database on startup
init_db()

# API Routes
@app.route('/api/scores', methods=['GET'])
def get_scores():
    try:
        logger.info("Fetching scores...")
        scores = Score.query.all()
        scores_data = [{"judge": score.judge, "team": score.team, "score": score.score} for score in scores]
        logger.info(f"Found {len(scores_data)} scores")
        return jsonify(scores_data)
    except Exception as e:
        logger.error(f"Error fetching scores: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e.__dict__)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/judges', methods=['GET'])
def get_judges():
    try:
        logger.info("Fetching judges...")
        # Get all judges from the judges table
        judges = Judge.query.all()
        judges_list = [judge.judge_name for judge in judges]
        logger.info(f"Found {len(judges_list)} judges")
        return jsonify(judges_list)
    except Exception as e:
        logger.error(f"Error fetching judges: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e.__dict__)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/judges', methods=['POST'])
def add_judge():
    try:
        data = request.get_json()
        logger.info(f"Received data for new judge: {data}")
        if not data or 'judge' not in data:
            return jsonify({"error": "Missing judge"}), 400
            
        judge_name = data['judge']
        
        # Check if judge already exists
        existing_judge = Judge.query.filter_by(judge_name=judge_name).first()
        if existing_judge:
            return jsonify({"error": "Judge already exists"}), 400
            
        # Create new judge
        new_judge = Judge(judge_name=judge_name)
        db.session.add(new_judge)
        db.session.commit()
        
        logger.info(f"Successfully added new judge: {judge_name}")
        return jsonify({"message": "Judge added successfully"}), 201
        
    except Exception as e:
        logger.error(f"Error adding judge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/scores', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        logger.info(f"Received score data: {data}")
        
        if not data or not all(key in data for key in ['judge', 'team', 'score']):
            logger.info("Missing required data in request")
            return jsonify({"success": True}), 200
        
        judge_id = data['judge']
        team_id = data['team']
        score = float(data['score'])
        
        logger.info(f"Processing score submission - Judge: {judge_id}, Team: {team_id}, Score: {score}")
        
        # Validate score range silently
        if not (0 <= score <= 3):
            logger.info(f"Invalid score value: {score}")
            return jsonify({"success": True}), 200
        
        # Use upsert to handle both insert and update silently
        score_obj = Score.query.filter_by(judge=judge_id, team=team_id).first()
        if score_obj:
            logger.info(f"Updating existing score for Judge: {judge_id}, Team: {team_id}")
            score_obj.score = score
        else:
            logger.info(f"Creating new score for Judge: {judge_id}, Team: {team_id}")
            score_obj = Score(judge=judge_id, team=team_id, score=score)
            db.session.add(score_obj)
        
        db.session.commit()
        logger.info(f"Successfully saved score for Judge: {judge_id}, Team: {team_id}")
        
        return jsonify({
            "success": True,
            "score": {
                "judge": judge_id,
                "team": team_id,
                "score": score
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Error submitting score: {str(e)}")
        db.session.rollback()
        return jsonify({"success": True}), 200

@app.route('/api/scores', methods=['DELETE'])
def clear_scores():
    try:
        logger.info("Clearing all scores...")
        with app.app_context():
            # Use DELETE FROM to clear all data while preserving table structure
            db.session.execute(text('DELETE FROM scores;'))
            db.session.commit()
            logger.info("All scores cleared successfully")
            return jsonify({"message": "All scores cleared successfully"}), 200
    except Exception as e:
        logger.error(f"Error clearing scores: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Static file serving (should be last)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
