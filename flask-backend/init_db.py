from app import app, db
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create the database tables
with app.app_context():
    try:
        db.create_all()
        print("Database tables created successfully!")
    except Exception as e:
        print(f"Error creating database tables: {e}") 