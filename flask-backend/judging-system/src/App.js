import React, { useState, useEffect } from "react";
import "./App1.css";

const BACKEND_URL = 'http://localhost:5001';

const getWeightedRandomTeams = (availableTeams, seenTeams, count) => {
  // Filter out Team 1 from available teams to prevent it from being assigned
  const validTeams = availableTeams.filter(team => team !== "Team 1");
  let candidates = validTeams.filter(team => !seenTeams.includes(team));
  
  // If we don't have enough unscored teams, allow rescoring some teams
  if (candidates.length < count) {
    const additionalNeeded = count - candidates.length;
    const rescoreCandidates = validTeams
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
  const [totalTeams, setTotalTeams] = useState(20);
  const [teams, setTeams] = useState(Array.from({ length: 20 }, (_, i) => `Team ${i + 1}`));
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState({});
  const [scoresByJudge, setScoresByJudge] = useState({});
  const [judges, setJudges] = useState([]);
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tempTeamInput, setTempTeamInput] = useState("20");  // New state for temporary input

  const updateTotalTeams = (newTotal) => {
    const numTeams = parseInt(newTotal);
    if (!isNaN(numTeams) && numTeams > 0) {
      setTotalTeams(numTeams);
      setTeams(Array.from({ length: numTeams }, (_, i) => `Team ${i + 1}`));
      // Reset all state to avoid issues with removed teams
      setCurrentTeamsByJudge({});
      setScoresByJudge({});
      setSeenTeamsByJudge({});
      setScoreTableData({});
      setCurrentJudge("");
    }
  };

  // Load judges on component mount
  useEffect(() => {
    const fetchJudges = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/judges`);
        if (!response.ok) {
          throw new Error('Failed to fetch judges');
        }
        const data = await response.json();
        setJudges(data);
      } catch (error) {
        console.error("Error fetching judges:", error);
      }
    };

    fetchJudges();
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [judgesRes, scoresRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/judges`, {
            headers: {
              'Content-Type': 'application/json'
            }
          }),
          fetch(`${BACKEND_URL}/api/scores`, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
        ]);

        const judgesData = await judgesRes.json();
        // Sort judges alphabetically
        const sortedJudges = judgesData.sort((a, b) => a.localeCompare(b));
        
        const scoresData = await scoresRes.json();

        // Initialize score table
        const newScoreTable = {};
        teams.forEach(team => {
          newScoreTable[team] = {};
        });

        // Only fill in scores that were explicitly submitted
        scoresData.forEach(({ team, judge, score }) => {
          if (!newScoreTable[team]) newScoreTable[team] = {};
          if (score !== null && score !== undefined) {
            newScoreTable[team][judge] = score;
          }
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
  }, [currentJudge, currentTeamsByJudge, seenTeamsByJudge]);

  const handleJudgeChange = (event) => {
    const selectedJudge = event.target.value;
    if (!selectedJudge) {
      setCurrentJudge("");
      return;
    }

    // Only assign new teams if this judge doesn't have any teams assigned yet
    if (!currentTeamsByJudge[selectedJudge]) {
      const judgeSeenTeams = seenTeamsByJudge[selectedJudge] || [];
      const newTeams = getWeightedRandomTeams(teams, judgeSeenTeams, 5);
      setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: newTeams }));
      setScoresByJudge(prev => ({ ...prev, [selectedJudge]: Array(5).fill("") }));
    }
    
    setCurrentJudge(selectedJudge);
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

      // Register judge in backend without creating any scores
      await fetch(`${BACKEND_URL}/api/judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judge: newJudge
        })
      });

      // Set current judge to the new judge
      setCurrentJudge(newJudge);
    } catch (error) {
      console.error("Error adding judge:", error);
      alert("Failed to add judge. Please try again.");
    }
  };

  const handleScoreChange = (index, value) => {
    // Convert to number and validate range
    const numValue = parseFloat(value);
    if (value === "" || (numValue >= 0 && numValue <= 3)) {
      setScoresByJudge(prev => ({
        ...prev,
        [currentJudge]: prev[currentJudge].map((score, i) => 
          i === index ? value : score
        )
      }));
    }
  };

  const handleSubmit = async () => {
    if (!currentJudge || scoresByJudge[currentJudge].some(score => score === "")) {
      alert("Please enter all scores before submitting.");
      return;
    }

    try {
      // Submit scores and update table immediately
      const currentTeams = currentTeamsByJudge[currentJudge];
      const currentScores = scoresByJudge[currentJudge];
      
      for (let i = 0; i < currentTeams.length; i++) {
        const team = currentTeams[i];
        const score = parseFloat(currentScores[i]);
        
        try {
          // Submit to backend
          const response = await fetch(`${BACKEND_URL}/api/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              judge: currentJudge,
              team: team,
              score: score
            })
          });

          if (!response.ok) {
            console.warn(`Warning: Failed to submit score for ${team}, continuing with other scores`);
            continue; // Continue with other scores even if one fails
          }

          // Update the score table immediately for each successful score
          setScoreTableData(prev => ({
            ...prev,
            [team]: {
              ...(prev[team] || {}),
              [currentJudge]: score
            }
          }));
        } catch (error) {
          console.warn(`Warning: Error submitting score for ${team}:`, error);
          continue; // Continue with other scores even if one fails
        }
      }

      // Update seen teams (only add teams that weren't previously seen)
      setSeenTeamsByJudge(prev => {
        const prevTeams = new Set(prev[currentJudge] || []);
        const newTeams = currentTeams.filter(team => !prevTeams.has(team));
        return {
          ...prev,
          [currentJudge]: [...prevTeams, ...newTeams]
        };
      });

      // Assign new teams, excluding current teams to avoid duplicates
      const newTeams = getWeightedRandomTeams(
        teams, 
        seenTeamsByJudge[currentJudge] || [], 
        5
      );
      setCurrentTeamsByJudge(prev => ({ ...prev, [currentJudge]: newTeams }));
      setScoresByJudge(prev => ({ ...prev, [currentJudge]: Array(5).fill("") }));

      alert('Scores submitted successfully!');
    } catch (error) {
      console.error("Error submitting scores:", error);
      alert('Some scores may not have been submitted. Please check the score table.');
      // Don't freeze - still allow continuing
    }
  };

  // Add or update the average calculation function
  const calculateAverage = (teamScores) => {
    const scores = Object.values(teamScores).filter(score => score !== undefined);
    if (scores.length === 0) return "";
    const sum = scores.reduce((a, b) => a + b, 0);
    return (sum / scores.length).toFixed(2);
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="settings-container" style={{ marginBottom: '20px' }}>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              style={{
                backgroundColor: '#1b2d3f',
                color: '#f1ead2',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
            
            {showSettings && (
              <div style={{
                padding: '15px',
                backgroundColor: '#1b2d3f',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ color: '#f1ead2' }}>Total Number of Teams: </label>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    value={tempTeamInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        setTempTeamInput(value);
                        if (value !== '' && parseInt(value) > 0) {
                          updateTotalTeams(parseInt(value));
                        }
                      }
                    }}
                    onBlur={() => {
                      if (tempTeamInput === '' || parseInt(tempTeamInput) <= 0) {
                        setTempTeamInput('1');
                        updateTotalTeams(1);
                      }
                    }}
                    style={{
                      padding: '5px',
                      width: '80px',
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

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
            {(currentTeamsByJudge[currentJudge] || [])
              .filter(team => team !== "Team 0")  // Hide Team 0 from input interface
              .map((team, index) => (
              <div key={team} className="team-input">
                <span>{team}</span>
                <input
                  type="number"
                  min="0"
                  max="3"
                  step="0.1"
                  placeholder="Score (0-3)"
                  value={scoresByJudge[currentJudge]?.[index] || ""}
                  onChange={(e) => handleScoreChange(index, e.target.value)}
                />
              </div>
            ))}
          </div>

          {currentJudge && (
            <button onClick={handleSubmit} className="submit-btn">
              Submit Scores
            </button>
          )}

          <h2>Score Table</h2>
          <div className="table-container" style={{
            overflowX: 'auto',
            maxWidth: '100%',
            marginTop: '20px'
          }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              whiteSpace: 'nowrap'
            }}>
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
                {teams
                  .map(team => {
                  const teamScores = scoreTableData[team] || {};
                  const average = calculateAverage(teamScores);
                  
                  return (
                    <tr key={team} style={team === "Team 0" ? { backgroundColor: '#fff3f3' } : {}}>
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
                        background: team === "Team 0" ? '#fff3f3' : 'white',
                        fontWeight: 'bold',
                        color: team === "Team 0" ? '#ff4444' : '#2c5282'
                      }}>{average}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
