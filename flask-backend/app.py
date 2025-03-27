from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import psycopg2
import logging
from sqlalchemy import text

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from the .env file
load_dotenv(override=True)

# Get the database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is not set")
    raise ValueError("DATABASE_URL environment variable is not set")

logger.info(f"Connecting to database...")

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app, supports_credentials=True)

# Configure the database
# For Supabase, we need to modify the URL slightly
if 'supabase' in DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL.replace('postgres://', 'postgresql://')
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL.replace('postgres://', 'postgresql://')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db = SQLAlchemy(app)

# Database Models
class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    judge = db.Column(db.String(80), nullable=False, index=True)
    team = db.Column(db.String(80), nullable=False, index=True)
    score = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # Add unique constraint to prevent duplicate scores
    __table_args__ = (
        db.UniqueConstraint('judge', 'team', name='unique_judge_team'),
    )

    def __init__(self, judge, team, score=None):
        self.judge = judge
        self.team = team
        self.score = score
        self.timestamp = None

# Test the connection
try:
    with app.app_context():
        db.engine.connect()
        # Create tables if they don't exist
        db.create_all()
        # Verify no automatic score creation
        initial_scores = Score.query.all()
        if initial_scores:
            logger.info(f"Found {len(initial_scores)} initial scores")
    logger.info("Database connection successful!")
except Exception as e:
    logger.error(f"Error connecting to database: {str(e)}")
    raise

def get_db_connection():
    if 'supabase' in DATABASE_URL:
        # Supabase connection
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    elif 'amazonaws.com' in DATABASE_URL:
        # Heroku PostgreSQL connection
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    else:
        # Local connection
        conn = psycopg2.connect(DATABASE_URL)
    return conn

# API Routes
@app.route('/api/scores', methods=['GET'])
def get_scores():
    try:
        logger.info("Fetching scores...")
        with app.app_context():
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
        # Get unique judges from the scores table
        judges = db.session.query(Score.judge).distinct().all()
        judges_list = [judge[0] for judge in judges]
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
            
        judge_id = data['judge']
        
        # Check if judge already exists
        existing_judge = db.session.query(Score.judge).filter_by(judge=judge_id).first()
        if existing_judge:
            return jsonify({"error": "Judge already exists"}), 400
            
        # Just return success - no need to create any database entries
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
            logger.error("Missing required data in request")
            return jsonify({"error": "Missing required data"}), 400
        
        judge_id = data['judge']
        team_id = data['team']
        score = float(data['score'])
        
        logger.info(f"Processing score submission - Judge: {judge_id}, Team: {team_id}, Score: {score}")
        
        # Validate score range
        if not (0 <= score <= 3):
            logger.error(f"Invalid score value: {score}")
            return jsonify({"error": "Score must be between 0 and 3"}), 400
        
        # Use upsert to handle both insert and update efficiently
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
            "message": "Score submitted successfully!",
            "score": {
                "judge": judge_id,
                "team": team_id,
                "score": score
            }
        }), 201
    
    except ValueError as e:
        logger.error(f"Invalid score value provided: {str(e)}")
        return jsonify({"error": "Invalid score value"}), 400
    except Exception as e:
        logger.error(f"Error submitting score: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/scores', methods=['DELETE'])
def clear_scores():
    try:
        logger.info("Clearing all scores and judges...")
        with app.app_context():
            # Use DELETE FROM to clear all data while preserving table structure
            db.session.execute(text('DELETE FROM scores;'))
            db.session.commit()
            logger.info("All scores and judges cleared successfully")
            return jsonify({"message": "All scores and judges cleared successfully"}), 200
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
