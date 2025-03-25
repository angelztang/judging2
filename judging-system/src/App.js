import React, { useState, useEffect } from "react";
import "./App1.css";

const BACKEND_URL = 'https://judging-system-a20f58757cfa.herokuapp.com';

function App() {
  const [selectedJudge, setSelectedJudge] = useState('');
  const [judges, setJudges] = useState([]);
  const [scores, setScores] = useState({});
  const [allScores, setAllScores] = useState([]);

  const fetchScores = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/scores`);
      const data = await response.json();
      setAllScores(data);
      
      // Update judges list
      const uniqueJudges = [...new Set(data.map(score => score.judge))];
      setJudges(uniqueJudges);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  const handleJudgeChange = (e) => {
    setSelectedJudge(e.target.value);
  };

  const handleScoreChange = (team, value) => {
    // Allow empty string or valid numbers
    if (value === "" || (!isNaN(value) && value >= 0 && value <= 3)) {
      setScores(prev => ({ ...prev, [team]: value }));
    } else {
      alert("Please enter a score between 0 and 3");
    }
  };

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all scores before submission
    for (const team in scores) {
      const score = parseFloat(scores[team]);
      if (isNaN(score) || score < 0 || score > 3) {
        alert("Please submit scores within the range of 0-3 for all teams");
        return;
      }
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          judge: selectedJudge,
          scores: scores
        }),
      });

      if (response.ok) {
        setScores({});
        fetchScores();
      } else {
        alert('Failed to submit scores. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting scores:', error);
      alert('Error submitting scores. Please try again.');
    }
  };

  const addNewJudge = () => {
    const name = prompt('Enter the name of the new judge:');
    if (name && name.trim()) {
      setJudges(prev => [...prev, name.trim()]);
      setSelectedJudge(name.trim());
    }
  };

  const teams = ['Team1', 'Team2', 'Team3', 'Team4', 'Team5'];

  return (
    <div className="container">
      <h1>HackPrinceton Judging System</h1>
      
      <div className="select-container">
        <select value={selectedJudge} onChange={handleJudgeChange}>
          <option value="">Select a judge</option>
          {judges.map(judge => (
            <option key={judge} value={judge}>{judge}</option>
          ))}
        </select>
        <button className="add-judge-btn" onClick={addNewJudge}>Add New Judge</button>
      </div>

      {selectedJudge && (
        <form onSubmit={handleScoreSubmit}>
          <div className="team-inputs">
            {teams.map(team => (
              <div key={team} className="team-input">
                <span>{team}:</span>
                <input
                  type="number"
                  min="0"
                  max="3"
                  step="0.1"
                  value={scores[team] || ''}
                  onChange={(e) => handleScoreChange(team, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button type="submit" className="submit-btn">Submit Scores</button>
        </form>
      )}

      <h2>All Scores</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              {judges.map(judge => (
                <th key={judge}>{judge}</th>
              ))}
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(team => (
              <tr key={team}>
                <td>{team}</td>
                {judges.map(judge => {
                  const score = allScores.find(s => s.judge === judge && s.team === team);
                  return <td key={judge}>{score ? score.score : '-'}</td>;
                })}
                <td>
                  {(() => {
                    const teamScores = allScores.filter(s => s.team === team).map(s => s.score);
                    if (teamScores.length === 0) return '-';
                    const avg = teamScores.reduce((a, b) => a + b, 0) / teamScores.length;
                    return avg.toFixed(2);
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
