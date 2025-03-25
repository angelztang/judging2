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
    judge_id = db.Column(db.String(80), nullable=False)
    team_id = db.Column(db.String(80), nullable=False)
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

# Endpoint to submit a score to the database
@app.route('/api/scores', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        
        # Check that the data contains the necessary fields
        if not data or not all(key in data for key in ['judge_id', 'team_id', 'score']):
            return jsonify({"error": "Missing required data"}), 400
        
        # Extract and validate the score data
        judge_id = data['judge_id']
        team_id = data['team_id']
        score = float(data['score'])
        
        # Validate score range
        if not (0 <= score <= 3):
            return jsonify({"error": "Score must be between 0 and 3"}), 400
        
        # Check if score already exists
        existing_score = Score.query.filter_by(judge_id=judge_id, team_id=team_id).first()
        if existing_score:
            # Update existing score
            print(f"Updating score for judge {judge_id} team {team_id} from {existing_score.score} to {score}")
            existing_score.score = score
            db.session.commit()
            return jsonify({"message": "Score updated successfully!"}), 200
        else:
            # Create a new Score object
            print(f"Creating new score for judge {judge_id} team {team_id}: {score}")
            new_score = Score(judge_id=judge_id, team_id=team_id, score=score)
            db.session.add(new_score)
            db.session.commit()
            return jsonify({"message": "Score submitted successfully!"}), 201
        
    except ValueError:
        return jsonify({"error": "Invalid score value"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
