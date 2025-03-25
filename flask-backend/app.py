from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__)
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

# Serve the frontend
@app.route('/')
def index():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'index.html')

# Optionally, handle any other frontend assets (like CSS or JS)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(os.path.join(app.root_path, 'static'), path)

# Endpoint to fetch all scores from the database
@app.route('/api/scores', methods=['GET'])
def get_scores():
    scores = Score.query.all()
    scores_data = [{"judge_id": score.judge_id, "team_id": score.team_id, "score": score.score} for score in scores]
    return jsonify(scores_data)

# Endpoint to submit a score to the database
@app.route('/api/scores', methods=['POST'])
def submit_score():
    data = request.get_json()
    
    # Check that the data contains the necessary fields
    if not data or not all(key in data for key in ['judge_id', 'team_id', 'score']):
        return jsonify({"error": "Missing required data"}), 400
    
    # Extract the score data
    judge_id = data['judge_id']
    team_id = data['team_id']
    score = data['score']
    
    # Create a new Score object
    new_score = Score(judge_id=judge_id, team_id=team_id, score=score)
    
    # Add the score to the database
    db.session.add(new_score)
    db.session.commit()
    
    return jsonify({"message": "Score submitted successfully!"}), 201

if __name__ == '__main__':
    app.run(debug=True)
