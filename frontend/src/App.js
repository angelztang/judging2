import React, { useState, useEffect } from "react";
import "./App1.css";

// Use environment variable for backend URL, fallback to localhost
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

// Style definitions
const tableHeaderStyle = {
  backgroundColor: '#1b2d3f',
  color: '#f1ead2',
  padding: '10px',
  textAlign: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 1
};

const tableCellStyle = {
  padding: '10px',
  textAlign: 'center',
  borderBottom: '1px solid #ddd'
};

const calculateAverage = (scores) => {
  const validScores = Object.values(scores).filter(score => score !== null && score !== undefined);
  if (validScores.length === 0) return "";
  const sum = validScores.reduce((a, b) => a + b, 0);
  return (sum / validScores.length).toFixed(2);
};

const getWeightedRandomTeams = (availableTeams, seenTeams, count, seenTeamsByJudge) => {
  // Get the current judge's seen teams
  const judgeSeenTeams = seenTeams || [];
  
  // Get all teams this judge hasn't seen yet
  let unseenTeams = availableTeams.filter(team => !judgeSeenTeams.includes(team));
  
  // If no unseen teams, return empty array
  if (unseenTeams.length === 0) {
    return [];
  }
  
  // Count how many times each unseen team has been judged
  const teamJudgmentCounts = {};
  unseenTeams.forEach(team => {
    teamJudgmentCounts[team] = 0;
    Object.values(seenTeamsByJudge).forEach(judgeTeams => {
      if (judgeTeams.includes(team)) {
        teamJudgmentCounts[team]++;
      }
    });
  });
  
  // Sort by number of times judged
  unseenTeams.sort((a, b) => teamJudgmentCounts[a] - teamJudgmentCounts[b]);
  
  // Return up to 'count' teams
  return unseenTeams.slice(0, count);
};

// Add error handling for score submission
const submitScore = async (judge, team, score) => {
  try {
    await fetch(`${BACKEND_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judge, team, score })
    });
    return true;
  } catch (error) {
    console.log("Error handled silently:", error);
    return true;
  }
};

function App() {
  // Load team range from localStorage on initial render
  const [teamRange, setTeamRange] = useState(() => {
    const savedRange = localStorage.getItem('teamRange');
    return savedRange ? JSON.parse(savedRange) : { start: 51, end: 99 };
  });
  
  const [teams, setTeams] = useState(() => {
    const range = teamRange;
    return Array.from({ length: range.end - range.start + 1 }, (_, i) => `Team ${i + range.start}`);
  });
  
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState({});
  const [scoresByJudge, setScoresByJudge] = useState({});
  const [judges, setJudges] = useState([]);
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tempTeamRange, setTempTeamRange] = useState({ start: 51, end: 99 });

  const updateTeamRange = (start, end) => {
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    if (!isNaN(startNum) && !isNaN(endNum) && startNum > 0 && endNum >= startNum) {
      const newRange = { start: startNum, end: endNum };
      setTeamRange(newRange);
      // Save to localStorage
      localStorage.setItem('teamRange', JSON.stringify(newRange));
      setTeams(Array.from({ length: endNum - startNum + 1 }, (_, i) => `Team ${i + startNum}`));
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [judgesRes, scoresRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/judges`),
          fetch(`${BACKEND_URL}/api/scores`)
        ]);

        const sortedJudges = (await judgesRes.json()).sort((a, b) => a.localeCompare(b));
        const scoresData = await scoresRes.json();

        // Initialize score table and seen teams
        const newScoreTable = {};
        const newSeenTeams = {};
        
        teams.forEach(team => {
          newScoreTable[team] = {};
        });

        // Fill in scores and track seen teams
        scoresData.forEach(({ team, judge, score }) => {
          if (!newScoreTable[team]) newScoreTable[team] = {};
          if (score !== null && score !== undefined) {
            newScoreTable[team][judge] = score;
            // Track this team as seen by this judge
            if (!newSeenTeams[judge]) newSeenTeams[judge] = [];
            if (!newSeenTeams[judge].includes(team)) {
              newSeenTeams[judge].push(team);
            }
          }
        });

        setJudges(sortedJudges);
        setScoreTableData(newScoreTable);
        setSeenTeamsByJudge(newSeenTeams);
        setIsLoading(false);
      } catch (error) {
        // Silently handle any errors
        console.log("Error handled silently:", error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [teams]);

  // Assign teams when judge is selected
  useEffect(() => {
    if (currentJudge && !currentTeamsByJudge[currentJudge]) {
      const seenTeams = seenTeamsByJudge[currentJudge] || [];
      const newTeams = getWeightedRandomTeams(teams, seenTeams, 5, seenTeamsByJudge);
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
      const unseenTeams = teams.filter(team => !judgeSeenTeams.includes(team));
      
      // If no unseen teams, don't assign any
      if (unseenTeams.length === 0) {
        setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: [] }));
        setScoresByJudge(prev => ({ ...prev, [selectedJudge]: [] }));
      } else {
        const newTeams = getWeightedRandomTeams(teams, judgeSeenTeams, 5, seenTeamsByJudge);
        setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: newTeams }));
        setScoresByJudge(prev => ({ ...prev, [selectedJudge]: Array(newTeams.length).fill("") }));
      }
    }
    
    setCurrentJudge(selectedJudge);
  };

  const addNewJudge = async () => {
    const newJudge = prompt("Enter your name:");
    if (!newJudge || judges.some(j => j.toLowerCase() === newJudge.toLowerCase())) return;

    try {
      // Add judge to state (maintaining sort)
      setJudges(prev => [...prev, newJudge].sort((a, b) => a.localeCompare(b)));
      
      // Check if there are any unseen teams
      const judgeSeenTeams = seenTeamsByJudge[newJudge] || [];
      const unseenTeams = teams.filter(team => !judgeSeenTeams.includes(team));
      
      // Only assign teams if there are unseen ones
      if (unseenTeams.length > 0) {
        const newTeams = getWeightedRandomTeams(teams, judgeSeenTeams, 5, seenTeamsByJudge);
        setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: newTeams }));
        setScoresByJudge(prev => ({ ...prev, [newJudge]: Array(newTeams.length).fill("") }));
      } else {
        setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: [] }));
        setScoresByJudge(prev => ({ ...prev, [newJudge]: [] }));
      }

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
      // Silently handle any errors
      console.log("Error handled silently:", error);
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
    if (!currentJudge) return;  // Only check if judge is selected

    try {
      const currentTeams = currentTeamsByJudge[currentJudge];
      const currentScores = scoresByJudge[currentJudge];
      
      // Get only the teams that have scores
      const teamsWithScores = currentTeams.filter((_, index) => currentScores[index] !== "");
      const validScores = currentScores.filter(score => score !== "");
      
      // Submit all scores in parallel
      const scorePromises = teamsWithScores.map((team, i) => 
        submitScore(currentJudge, team, parseFloat(validScores[i]))
      );
      
      // Wait for all scores to be submitted
      await Promise.all(scorePromises);

      // Update the score table with submitted scores
      const newScoreTable = { ...scoreTableData };
      teamsWithScores.forEach((team, i) => {
        if (!newScoreTable[team]) newScoreTable[team] = {};
        newScoreTable[team][currentJudge] = parseFloat(validScores[i]);
      });
      setScoreTableData(newScoreTable);

      // Update seen teams - only mark teams that were actually scored as seen
      setSeenTeamsByJudge(prev => ({
        ...prev,
        [currentJudge]: [...(prev[currentJudge] || []), ...teamsWithScores]
      }));

      // Clear current teams and scores for this judge
      setCurrentTeamsByJudge(prev => {
        const newState = { ...prev };
        delete newState[currentJudge];
        return newState;
      });
      setScoresByJudge(prev => {
        const newState = { ...prev };
        delete newState[currentJudge];
        return newState;
      });

      // Reset current judge
      setCurrentJudge("");
    } catch (error) {
      // Silently handle any errors
      console.log("Error handled silently:", error);
    }
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
                  <label style={{ color: '#f1ead2' }}>Team Range: </label>
                  <div className="range-inputs">
                    <input
                      type="number"
                      value={tempTeamRange.start}
                      onChange={(e) => setTempTeamRange(prev => ({ ...prev, start: e.target.value }))}
                      min="1"
                      placeholder="Start"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      value={tempTeamRange.end}
                      onChange={(e) => setTempTeamRange(prev => ({ ...prev, end: e.target.value }))}
                      min={tempTeamRange.start}
                      placeholder="End"
                    />
                  </div>
                  <button onClick={() => updateTeamRange(tempTeamRange.start, tempTeamRange.end)}>
                    Update Range
                  </button>
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

          {currentJudge && (
            <form onSubmit={handleSubmit}>
              <div className="team-inputs">
                {(currentTeamsByJudge[currentJudge] || [])
                  .filter(team => team !== "Team 0")  // Hide Team 0 from input interface
                  .map((team, index) => (
                    <div key={team} className="team-input">
                      <span>{team}:</span>
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

              <button type="submit" className="submit-btn">Submit Scores</button>
            </form>
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

export default App;
