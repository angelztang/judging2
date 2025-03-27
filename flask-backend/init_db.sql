-- Create judges table if it doesn't exist
CREATE TABLE IF NOT EXISTS judges (
    id SERIAL PRIMARY KEY,
    judge_name VARCHAR(80) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create scores table if it doesn't exist
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    judge VARCHAR(80) NOT NULL,
    team VARCHAR(80) NOT NULL,
    score FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(judge, team)
);

-- Create index on judge and team columns
CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores(judge);
CREATE INDEX IF NOT EXISTS idx_scores_team ON scores(team); 