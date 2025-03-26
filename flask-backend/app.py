from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import psycopg2
import logging

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
CORS(app)  # Allow all origins

# Configure the database
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL.replace('postgres://', 'postgresql://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

try:
    db = SQLAlchemy(app)
    # Test the connection
    with app.app_context():
        # Enable SSL mode for Heroku
        if 'amazonaws.com' in DATABASE_URL:
            db.engine.execute("SET SESSION ssl_mode='require';")
        db.engine.connect()
        # Create tables if they don't exist
        db.create_all()
    logger.info("Database connection successful!")
except Exception as e:
    logger.error(f"Error connecting to database: {str(e)}")
    raise

def get_db_connection():
    if 'amazonaws.com' in DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    else:
        conn = psycopg2.connect(DATABASE_URL)
    return conn

# Score model
class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    judge = db.Column(db.String(80), nullable=False, index=True)
    team = db.Column(db.String(80), nullable=False, index=True)
    score = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=True)
    
    # Add unique constraint to prevent duplicate scores
    __table_args__ = (
        db.UniqueConstraint('judge', 'team', name='unique_judge_team'),
    )

# Serve the frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Endpoint to fetch all scores from the database
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

# Endpoint to get all unique judges
@app.route('/api/judges', methods=['GET'])
def get_judges():
    try:
        logger.info("Fetching judges...")
        with app.app_context():
            judges = db.session.query(Score.judge).distinct().all()
            judges_list = [judge[0] for judge in judges]
            logger.info(f"Found {len(judges_list)} judges")
            return jsonify(judges_list)
    except Exception as e:
        logger.error(f"Error fetching judges: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e.__dict__)}")
        return jsonify({"error": str(e)}), 500

# Endpoint to add a new judge
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
            
        # Create an initial score entry to persist the judge
        initial_score = Score(
            judge=judge_id,
            team="Team 1",  # Using a placeholder team
            score=0
        )
        db.session.add(initial_score)
        db.session.commit()
        
        return jsonify({"message": "Judge added successfully"}), 201
        
    except Exception as e:
        logger.error(f"Error adding judge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Endpoint to submit a score to the database
@app.route('/api/scores', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        logger.info(f"Received score data: {data}")
        
        if not data or not all(key in data for key in ['judge', 'team', 'score']):
            return jsonify({"error": "Missing required data"}), 400
        
        judge_id = data['judge']
        team_id = data['team']
        score = float(data['score'])
        
        if not (0 <= score <= 3):
            return jsonify({"error": "Score must be between 0 and 3"}), 400
        
        # Use upsert to handle both insert and update efficiently
        score_obj = Score.query.filter_by(judge=judge_id, team=team_id).first()
        if score_obj:
            score_obj.score = score
        else:
            score_obj = Score(judge=judge_id, team=team_id, score=score)
            db.session.add(score_obj)
        
        db.session.commit()
        
        # Return the complete updated data
        return jsonify({
            "message": "Score submitted successfully!",
            "score": {
                "judge": judge_id,
                "team": team_id,
                "score": score
            }
        }), 201
    
    except Exception as e:
        logger.error(f"Error submitting score: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
