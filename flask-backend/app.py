from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os
import os
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # This will allow cross-origin requests from your React app

# Connect to the database
DATABASE_URL = os.environ['DATABASE_URL']  # Heroku provides this as an environment variable

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    return conn

@app.route('/scores', methods=['GET', 'POST'])
def scores():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM scores')
        scores = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(scores)

    elif request.method == 'POST':
        data = request.json
        team = data.get('team')
        judge = data.get('judge')
        score = data.get('score')

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO scores (team, judge, score) VALUES (%s, %s, %s)', (team, judge, score))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Score added successfully"}), 201

@app.route('/teams', methods=['GET'])
def teams():
    # Retrieve a list of all teams (or any other relevant data)
    return jsonify({"teams": ["Team 1", "Team 2", "Team 3"]})

if __name__ == '__main__':
    app.run(debug=True)
