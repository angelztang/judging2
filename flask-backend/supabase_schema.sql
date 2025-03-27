-- Create the score table
CREATE TABLE IF NOT EXISTS score (
    id SERIAL PRIMARY KEY,
    judge VARCHAR(80) NOT NULL,
    team VARCHAR(80) NOT NULL,
    score FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(judge, team)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_score_judge ON score(judge);
CREATE INDEX IF NOT EXISTS idx_score_team ON score(team); 