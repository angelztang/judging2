from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')
# Configure CORS to allow requests from any origin
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure the database if DATABASE_URL is available
db = None
if 'DATABASE_URL' in os.environ:
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL'].replace('postgres', 'postgresql+psycopg2')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db = SQLAlchemy(app)
    
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

    # Initialize database tables
    with app.app_context():
        try:
            db.create_all()
            print("Database tables created successfully!")
        except Exception as e:
            print(f"Error creating database tables: {e}")
else:
    print("No database URL configured. Database functionality will be disabled.")

# Serve static files from the React app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# API endpoints
@app.route('/api/scores', methods=['GET'])
def get_scores():
    try:
        scores = Score.query.all()
        scores_data = [{"judge_id": score.judge_id, "team_id": score.team_id, "score": score.score} for score in scores]
        print("Fetched scores:", scores_data)  # Add logging
        return jsonify(scores_data)
    except Exception as e:
        print(f"Error fetching scores: {e}")  # Add logging
        return jsonify({"error": str(e)}), 500

@app.route('/api/scores', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        print("Received score data:", data)
        
        if not data or not all(key in data for key in ['judge_id', 'team_id', 'score']):
            return jsonify({"error": "Missing required data"}), 400
        
        judge_id = data['judge_id']
        team_id = data['team_id']
        score = float(data['score'])
        
        if not (0 <= score <= 10):
            return jsonify({"error": "Score must be between 0 and 10"}), 400
        
        # Only add the score if it doesn't exist
        existing_score = Score.query.filter_by(judge_id=judge_id, team_id=team_id).first()
        if not existing_score:
            new_score = Score(judge_id=judge_id, team_id=team_id, score=score)
            db.session.add(new_score)
            print(f"Adding new score for {judge_id}, {team_id}: {score}")
            db.session.commit()
            return jsonify({"message": "Score submitted successfully!"}), 201
        else:
            print(f"Ignoring duplicate score for {judge_id}, {team_id}")
            return jsonify({"message": "Score already exists, ignoring duplicate"}), 200
        
    except ValueError as e:
        print(f"Value error: {e}")
        return jsonify({"error": "Invalid score value"}), 400
    except Exception as e:
        print(f"Error submitting score: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
