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
  
  // Count how many times each team has been judged across all judges
  const teamJudgmentCounts = {};
  availableTeams.forEach(team => {
    teamJudgmentCounts[team] = 0;
  });
  
  // Count judgments from all judges
  Object.values(seenTeamsByJudge).forEach(judgeTeams => {
    judgeTeams.forEach(team => {
      if (teamJudgmentCounts[team] !== undefined) {
        teamJudgmentCounts[team]++;
      }
    });
  });
  
  // Get all available teams that haven't been seen by this judge
  let candidates = availableTeams.filter(team => !judgeSeenTeams.includes(team));
  
  // If we don't have enough unscored teams, allow rescoring some teams
  if (candidates.length < count) {
    const additionalNeeded = count - candidates.length;
    const rescoreCandidates = availableTeams
      .filter(team => judgeSeenTeams.includes(team))
      .sort(() => Math.random() - 0.5)
      .slice(0, additionalNeeded);
    candidates = [...candidates, ...rescoreCandidates];
  }
  
  // Shuffle candidates first
  candidates.sort(() => Math.random() - 0.5);
  
  // Group teams by their judgment count
  const groupedTeams = {};
  candidates.forEach(team => {
    const count = teamJudgmentCounts[team];
    if (!groupedTeams[count]) {
      groupedTeams[count] = [];
    }
    groupedTeams[count].push(team);
  });
  
  // Get the minimum judgment count
  const minCount = Math.min(...Object.keys(groupedTeams).map(Number));
  
  // Start with teams that have been judged the least
  let selectedTeams = [...groupedTeams[minCount]];
  
  // If we need more teams, add from the next least judged group
  if (selectedTeams.length < count) {
    const nextCount = Math.min(...Object.keys(groupedTeams)
      .map(Number)
      .filter(n => n > minCount));
    if (nextCount !== Infinity) {
      selectedTeams = [...selectedTeams, ...groupedTeams[nextCount]];
    }
  }
  
  // Shuffle the selected teams
  selectedTeams.sort(() => Math.random() - 0.5);
  
  // Try each team as a starting point to find a valid range
  for (let i = 0; i < selectedTeams.length; i++) {
    const firstTeam = selectedTeams[i];
    const firstTeamNum = parseInt(firstTeam.split(' ')[1]);
    
    // Get all teams within 7 numbers of the first team
    const potentialTeams = selectedTeams.filter(team => {
      const teamNum = parseInt(team.split(' ')[1]);
      return Math.abs(teamNum - firstTeamNum) <= 7;
    });
    
    // If we have enough teams, try to find a subset that meets our range requirement
    if (potentialTeams.length >= count) {
      // Try different combinations of teams
      for (let j = 0; j <= potentialTeams.length - count; j++) {
        const testTeams = potentialTeams.slice(j, j + count);
        const teamNumbers = testTeams.map(team => parseInt(team.split(' ')[1]));
        const minTeam = Math.min(...teamNumbers);
        const maxTeam = Math.max(...teamNumbers);
        
        // If the range is 7 or less, we found a valid set
        if (maxTeam - minTeam <= 7) {
          return testTeams;
        }
      }
    }
  }
  
  // If we couldn't find a valid set from the selected teams, try with all candidates
  const allTeams = [...candidates];
  for (let i = 0; i < allTeams.length; i++) {
    const firstTeam = allTeams[i];
    const firstTeamNum = parseInt(firstTeam.split(' ')[1]);
    
    // Get all teams within 7 numbers of the first team
    const potentialTeams = allTeams.filter(team => {
      const teamNum = parseInt(team.split(' ')[1]);
      return Math.abs(teamNum - firstTeamNum) <= 7;
    });
    
    // If we have enough teams, try to find a subset that meets our range requirement
    if (potentialTeams.length >= count) {
      // Try different combinations of teams
      for (let j = 0; j <= potentialTeams.length - count; j++) {
        const testTeams = potentialTeams.slice(j, j + count);
        const teamNumbers = testTeams.map(team => parseInt(team.split(' ')[1]));
        const minTeam = Math.min(...teamNumbers);
        const maxTeam = Math.max(...teamNumbers);
        
        // If the range is 7 or less, we found a valid set
        if (maxTeam - minTeam <= 7) {
          return testTeams;
        }
      }
    }
  }
  
  // If we still can't find enough teams, return an empty array
  return [];
};

// Add error handling for score submission
const submitScore = async (judge, team, score) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judge: judge,
        team: team,
        score: score
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit score');
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting score:', error);
    throw error;
  }
};

function App() {
  // Load team range from localStorage on initial render
  const [teamRange, setTeamRange] = useState(() => {
    const savedRange = localStorage.getItem('teamRange');
    return savedRange ? JSON.parse(savedRange) : { start: 51, end: 99 };
  });
  
  const [teams, setTeams] = useState(() => {
    const savedRange = localStorage.getItem('teamRange');
    const range = savedRange ? JSON.parse(savedRange) : { start: 51, end: 99 };
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
      const newTeams = getWeightedRandomTeams(teams, judgeSeenTeams, 5, seenTeamsByJudge);
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
      const newTeams = getWeightedRandomTeams(teams, [], 5, seenTeamsByJudge);
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
      
      // Create an array of promises for all score submissions
      const submissionPromises = currentTeams.map((team, i) => {
        const score = parseFloat(currentScores[i]);
        return submitScore(currentJudge, team, score);
      });

      // Wait for all submissions to complete
      await Promise.all(submissionPromises);

      // Update the score table with all scores
      const newScoreTable = { ...scoreTableData };
      currentTeams.forEach((team, i) => {
        if (!newScoreTable[team]) newScoreTable[team] = {};
        newScoreTable[team][currentJudge] = parseFloat(currentScores[i]);
      });
      setScoreTableData(newScoreTable);

      // Update seen teams
      setSeenTeamsByJudge(prev => ({
        ...prev,
        [currentJudge]: [...(prev[currentJudge] || []), ...currentTeams]
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

      alert("All scores submitted successfully!");
    } catch (error) {
      console.error("Error submitting scores:", error);
      alert(`Error submitting scores: ${error.message}. Please try again or contact support if the issue persists.`);
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
