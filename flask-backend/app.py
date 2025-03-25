from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # This will allow cross-origin requests from your React app

# Configure the database
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL'].replace('postgres', 'postgresql+psycopg2') # Heroku provides this as an environment variable
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Disable unnecessary tracking
db = SQLAlchemy(app)

DATABASE_URL = os.environ['DATABASE_URL']

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    return conn

# Score model
class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    judge_id = db.Column(db.String(80), nullable=False, index=True)
    team_id = db.Column(db.String(80), nullable=False, index=True)
    score = db.Column(db.Float, nullable=False)
    
    # Add unique constraint to prevent duplicate scores
    __table_args__ = (
        db.UniqueConstraint('judge_id', 'team_id', name='unique_judge_team'),
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
        scores = Score.query.all()
        scores_data = [{"judge_id": score.judge_id, "team_id": score.team_id, "score": score.score} for score in scores]
        return jsonify(scores_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint to get all unique judges
@app.route('/api/judges', methods=['GET'])
def get_judges():
    try:
        judges = db.session.query(Score.judge_id).distinct().all()
        judges_list = [judge[0] for judge in judges]
        return jsonify(judges_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint to add a new judge
@app.route('/api/judges', methods=['POST'])
def add_judge():
    try:
        data = request.get_json()
        if not data or 'judge_id' not in data:
            return jsonify({"error": "Missing judge_id"}), 400
            
        judge_id = data['judge_id']
        
        # Check if judge already exists
        existing_judge = db.session.query(Score.judge_id).filter_by(judge_id=judge_id).first()
        if existing_judge:
            return jsonify({"error": "Judge already exists"}), 400
            
        # Create an initial score entry to persist the judge
        initial_score = Score(
            judge_id=judge_id,
            team_id="Team 1",  # Using a placeholder team
            score=0
        )
        db.session.add(initial_score)
        db.session.commit()
        
        return jsonify({"message": "Judge added successfully"}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Endpoint to submit a score to the database
@app.route('/api/scores', methods=['POST'])
def submit_score():
    data = request.json
    judge = data.get('judge')
    scores = data.get('scores')
    
    # Validate scores
    for team, score in scores.items():
        try:
            score_value = float(score)
            if not (0 <= score_value <= 3):
                return jsonify({'error': 'Scores must be between 0 and 3'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid score format'}), 400
    
    # If validation passes, proceed with saving scores
    for team, score in scores.items():
        score_entry = Score(
            judge_id=judge,
            team_id=team,
            score=float(score)
        )
        db.session.add(score_entry)
    
    try:
        db.session.commit()
        return jsonify({'message': 'Scores submitted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to save scores'}), 500

if __name__ == '__main__':
    app.run(debug=True)
