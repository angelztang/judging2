import React, { useState, useEffect } from "react";
import "./App1.css";

const teams = Array.from({ length: 20 }, (_, i) => `Team ${i + 1}`);
const BACKEND_URL = 'https://judging-system-a20f58757cfa.herokuapp.com';

const getWeightedRandomTeams = (availableTeams, seenTeams, count) => {
  let candidates = availableTeams.filter(team => !seenTeams.includes(team));
  
  // If we don't have enough unscored teams, allow rescoring some teams
  if (candidates.length < count) {
    const additionalNeeded = count - candidates.length;
    const rescoreCandidates = availableTeams
      .filter(team => seenTeams.includes(team))
      .sort(() => Math.random() - 0.5)
      .slice(0, additionalNeeded);
    candidates = [...candidates, ...rescoreCandidates];
  }
  
  // Shuffle the candidates
  candidates.sort(() => Math.random() - 0.5);
  
  return candidates.slice(0, count);
};

function App() {
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState({});
  const [scoresByJudge, setScoresByJudge] = useState({});
  const [judges, setJudges] = useState([]);
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [allScores, setAllScores] = useState([]);
  const [scores, setScores] = useState({});

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [judgesRes, scoresRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/judges`),
          fetch(`${BACKEND_URL}/api/scores`)
        ]);

        const judgesData = await judgesRes.json();
        // Sort judges alphabetically
        const sortedJudges = judgesData.sort((a, b) => a.localeCompare(b));
        
        const scoresData = await scoresRes.json();

        // Initialize score table
        const newScoreTable = {};
        teams.forEach(team => {
          newScoreTable[team] = {};
          // Initialize all scores as undefined (not empty string)
          sortedJudges.forEach(judge => {
            newScoreTable[team][judge] = undefined;
          });
        });

        // Fill in scores, including zeros
        scoresData.forEach(({ team_id, judge_id, score }) => {
          if (!newScoreTable[team_id]) newScoreTable[team_id] = {};
          newScoreTable[team_id][judge_id] = score; // Store number directly
        });

        setJudges(sortedJudges);
        setScoreTableData(newScoreTable);
        setSeenTeamsByJudge({});
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        alert("Error loading data. Please refresh the page.");
      }
    };

    loadData();
  }, []);

  // Assign teams when judge is selected
  useEffect(() => {
    if (currentJudge && !currentTeamsByJudge[currentJudge]) {
      const seenTeams = seenTeamsByJudge[currentJudge] || [];
      const newTeams = getWeightedRandomTeams(teams, seenTeams, 5);
      setCurrentTeamsByJudge(prev => ({ ...prev, [currentJudge]: newTeams }));
      setScoresByJudge(prev => ({ ...prev, [currentJudge]: Array(5).fill("") }));
    }
  }, [currentJudge]);

  const handleJudgeChange = (event) => {
    const selectedJudge = event.target.value;
    if (!selectedJudge) {
      setCurrentJudge("");
      setCurrentTeamsByJudge({});
      setScoresByJudge({});
      return;
    }

    const judgeSeenTeams = seenTeamsByJudge[selectedJudge] || [];
    const newTeams = getWeightedRandomTeams(teams, judgeSeenTeams, 5);
    
    setCurrentJudge(selectedJudge);
    setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: newTeams }));
    setScoresByJudge(prev => ({ ...prev, [selectedJudge]: Array(5).fill("") }));
  };

  const addNewJudge = async () => {
    const newJudge = prompt("Enter your name:");
    if (!newJudge) return;
    
    // Check case-insensitive duplicates
    if (judges.some(j => j.toLowerCase() === newJudge.toLowerCase())) {
      alert("Judge already exists!");
      return;
    }

    try {
      // Add judge to state (maintaining sort)
      setJudges(prev => [...prev, newJudge].sort((a, b) => a.localeCompare(b)));
      
      // Assign teams immediately
      const newTeams = getWeightedRandomTeams(teams, [], 5);
      setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: newTeams }));
      setScoresByJudge(prev => ({ ...prev, [newJudge]: Array(5).fill("") }));

      // Register judge in backend
      await fetch(`${BACKEND_URL}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judge_id: newJudge,
          team_id: "Team 1",
          score: 0
        })
      });
    } catch (error) {
      console.error("Error adding judge:", error);
      alert("Failed to add judge. Please try again.");
    }
  };

  const handleScoreChange = (team, value) => {
    // Allow empty string or valid numbers
    if (value === "" || (!isNaN(value) && value >= 0 && value <= 3)) {
      setScores(prev => ({ ...prev, [team]: value }));
    } else {
      alert("Please enter a score between 0 and 3");
    }
  };

  const fetchScores = async () => {
    try {
      console.log('Fetching scores from:', `${BACKEND_URL}/api/scores`);
      const response = await fetch(`${BACKEND_URL}/api/scores`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received scores data:', data);
      
      if (!Array.isArray(data)) {
        throw new Error('Received invalid data format');
      }

      setAllScores(data);
      
      // Update judges list
      const uniqueJudges = [...new Set(data.map(score => score.judge))];
      setJudges(uniqueJudges);
      
      // Update teams list if not already set
      const uniqueTeams = [...new Set(data.map(score => score.team))];
      if (uniqueTeams.length > 0) {
        setTeams(uniqueTeams);
      }
    } catch (error) {
      console.error('Error fetching scores:', error);
      setAllScores([]);  // Set empty array on error
      alert('Error loading data. Please refresh the page.');
    }
  };

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    
    // Check if we have scores for all teams
    const missingTeams = teams.filter(team => !scores[team] && scores[team] !== 0);
    if (missingTeams.length > 0) {
      alert(`Please submit scores for all teams. Missing: ${missingTeams.join(', ')}`);
      return;
    }

    // Validate score range
    for (const team in scores) {
      const score = parseFloat(scores[team]);
      if (isNaN(score) || score < 0 || score > 3) {
        alert("Please submit scores within the range of 0-3 for all teams");
        return;
      }
    }

    try {
      // Log for debugging
      console.log('Submitting scores:', scores);
      console.log('Selected judge:', currentJudge);

      const response = await fetch(`${BACKEND_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          judge: currentJudge,
          scores: scores
        }),
      });

      if (response.ok) {
        alert('Scores submitted successfully!');
        setScores({});
        await fetchScores();
      } else {
        const errorData = await response.json();
        alert(`Failed to submit scores: ${errorData.error || 'Please try again'}`);
      }
    } catch (error) {
      console.error('Error submitting scores:', error);
      alert('Error submitting scores. Please try again.');
    }
  };

  // Make sure we're fetching data when component mounts
  useEffect(() => {
    fetchScores();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchScores, 30000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Add this for debugging
  useEffect(() => {
    console.log('Current scores state:', scores);
    console.log('Teams:', teams);
  }, [scores, teams]);

  // Add or update the average calculation function
  const calculateAverage = (teamScores) => {
    const scores = Object.values(teamScores).filter(score => score !== undefined);
    if (scores.length === 0) return "";
    const sum = scores.reduce((a, b) => a + b, 0);
    return (sum / scores.length).toFixed(2);
  };

  // Add error boundary for the table component
  const renderScoresTable = () => {
    try {
      if (!allScores || allScores.length === 0) {
        return <p>No scores available. Please submit some scores.</p>;
      }

      return (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Team</th>
                {judges.map(judge => (
                  <th key={judge} style={tableHeaderStyle}>{judge}</th>
                ))}
                <th style={{
                  ...tableHeaderStyle,
                  position: 'sticky',
                  right: 0,
                  zIndex: 1
                }}>Average</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => {
                const teamScores = scoreTableData[team] || {};
                const average = calculateAverage(teamScores);
                
                return (
                  <tr key={team}>
                    <td style={tableCellStyle}>{team}</td>
                    {judges.map(judge => (
                      <td key={`${team}-${judge}`} style={tableCellStyle}>
                        {teamScores[judge] !== undefined ? teamScores[judge] : ""}
                      </td>
                    ))}
                    <td style={{
                      ...tableCellStyle,
                      position: 'sticky',
                      right: 0,
                      background: 'white',
                      fontWeight: 'bold',
                      color: '#2c5282'
                    }}>{average}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    } catch (error) {
      console.error('Error rendering table:', error);
      return <p>Error displaying scores. Please refresh the page.</p>;
    }
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="select-container">
            <label>Select Judge: </label>
            <select 
              value={currentJudge} 
              onChange={handleJudgeChange}
              style={{ minWidth: '200px' }}
            >
              <option value="">Select a judge</option>
              {judges.map(judge => (
                <option key={judge} value={judge}>{judge}</option>
              ))}
            </select>
            <button onClick={addNewJudge} className="add-judge-btn">
              + Add New Judge
            </button>
          </div>

          <div className="team-inputs">
            {(currentTeamsByJudge[currentJudge] || []).map((team, index) => (
              <div key={team} className="team-input">
                <span>{team}</span>
                <input
                  type="number"
                  min="0"
                  max="3"
                  placeholder="Score (0-3)"
                  value={scoresByJudge[currentJudge]?.[index] || ""}
                  onChange={(e) => handleScoreChange(team, e.target.value)}
                />
              </div>
            ))}
          </div>

          {currentJudge && (
            <button onClick={handleScoreSubmit} className="submit-btn">
              Submit Scores
            </button>
          )}

          <h2>Score Table</h2>
          {renderScoresTable()}
        </>
      )}
    </div>
  );
}

// Simplified styles
const tableHeaderStyle = {
  padding: '8px 15px',
  textAlign: 'center',
  background: 'white',
  color: '#2c5282'
};

const tableCellStyle = {
  padding: '8px 15px',
  textAlign: 'center',
  borderBottom: '1px solid #ddd',
  color: '#2c5282'
};

// Add some CSS to your App1.css file
const cssToAdd = `
.table-container {
  overflow-x: auto;
  max-width: 100%;
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 5px;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  background-color: white;
}

th, td {
  border: 1px solid #ddd;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

tr:hover {
  background-color: #f5f5f5;
}

.container {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
}
`;

export default App;
