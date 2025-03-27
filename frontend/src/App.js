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

const getUnseenTeams = (availableTeams, seenTeams) => {
  const unseenTeams = availableTeams.filter(team => !seenTeams.includes(team));
  console.log('Unseen teams:', unseenTeams);
  return unseenTeams;
};

// Add Fisher-Yates shuffle function
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const getTeamsToAssign = (availableTeams, seenTeamsByJudge, judgeSeenTeams, currentTeamsByJudge, currentJudge) => {
  console.log('Getting teams to assign for judge:', currentJudge);
  console.log('Judge seen teams:', judgeSeenTeams);
  console.log('All available teams:', availableTeams);
  
  // Get all teams this judge hasn't seen yet
  const judgeUnseenTeams = availableTeams.filter(team => {
    const hasSeen = judgeSeenTeams.includes(team);
    console.log(`Team ${team}: ${hasSeen ? 'seen' : 'unseen'}`);
    return !hasSeen;
  });
  
  console.log('Judge unseen teams:', judgeUnseenTeams);
  
  // Get currently assigned teams across all judges, excluding the current judge
  const currentlyAssignedTeams = new Set();
  Object.entries(currentTeamsByJudge).forEach(([judge, teams]) => {
    if (judge !== currentJudge) {  // Don't count teams assigned to the current judge
      teams.forEach(team => currentlyAssignedTeams.add(team));
    }
  });

  // Count how many times each unseen team has been judged
  const teamJudgmentCounts = {};
  judgeUnseenTeams.forEach(team => {
    teamJudgmentCounts[team] = Object.values(seenTeamsByJudge).filter(judgeTeams => judgeTeams.includes(team)).length;
  });

  // Sort unseen teams by judgment count (least judged first)
  const sortedUnseenTeams = [...judgeUnseenTeams].sort((a, b) => {
    const countDiff = teamJudgmentCounts[a] - teamJudgmentCounts[b];
    return countDiff === 0 ? parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]) : countDiff;
  });

  // If we have 5 or more teams available, just take 5 regardless of range or current assignments
  if (sortedUnseenTeams.length >= 5) {
    const assignedTeams = shuffleArray([...sortedUnseenTeams])
      .slice(0, 5)
      .sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
    return assignedTeams;
  }

  // If we have fewer than 5 teams, try to find teams within range
  let assignedTeams = [];
  for (let i = 0; i < sortedUnseenTeams.length && assignedTeams.length === 0; i++) {
    const startTeam = parseInt(sortedUnseenTeams[i].split(' ')[1]);
    const teamsInRange = sortedUnseenTeams.filter(team => {
      const teamNum = parseInt(team.split(' ')[1]);
      return Math.abs(teamNum - startTeam) <= 9;
    });

    if (teamsInRange.length >= 5) {
      // If we found 5 or more teams in range, shuffle and take 5
      assignedTeams = shuffleArray([...teamsInRange])
        .slice(0, 5)
        .sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
    }
  }

  // If we couldn't find 5 teams in range, just take all available teams
  if (assignedTeams.length === 0 && sortedUnseenTeams.length > 0) {
    assignedTeams = sortedUnseenTeams
      .sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
  }

  return assignedTeams;
};

// Add error handling for score submission
const submitScore = async (judge, team, score) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judge, team, score })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error submitting score for ${team} by ${judge}:`, error);
    throw error; // Re-throw to handle in the calling function
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
    const teamsList = Array.from({ length: range.end - range.start + 1 }, (_, i) => `Team ${i + range.start}`);
    console.log('DEBUG - Initializing teams:', teamsList);
    return teamsList;
  });
  
  // Initialize states with localStorage data
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState(() => {
    const saved = localStorage.getItem('currentTeamsByJudge');
    return saved ? JSON.parse(saved) : {};
  });
  const [scoresByJudge, setScoresByJudge] = useState(() => {
    const saved = localStorage.getItem('scoresByJudge');
    return saved ? JSON.parse(saved) : {};
  });
  const [isAssigningTeams, setIsAssigningTeams] = useState(false);
  
  // Load judges from localStorage on initial render
  const [judges, setJudges] = useState(() => {
    const saved = localStorage.getItem('judges');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tempTeamRange, setTempTeamRange] = useState({ start: 51, end: 99 });

  // Save current teams and scores to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(currentTeamsByJudge).length > 0) {
      localStorage.setItem('currentTeamsByJudge', JSON.stringify(currentTeamsByJudge));
    }
  }, [currentTeamsByJudge]);

  useEffect(() => {
    if (Object.keys(scoresByJudge).length > 0) {
      localStorage.setItem('scoresByJudge', JSON.stringify(scoresByJudge));
    }
  }, [scoresByJudge]);

  // Save judges and team range to localStorage
  useEffect(() => {
    localStorage.setItem('judges', JSON.stringify(judges));
  }, [judges]);

  useEffect(() => {
    localStorage.setItem('teamRange', JSON.stringify(teamRange));
  }, [teamRange]);

  const updateTeamRange = (start, end) => {
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    if (!isNaN(startNum) && !isNaN(endNum) && startNum > 0 && endNum >= startNum) {
      const newRange = { start: startNum, end: endNum };
      setTeamRange(newRange);
      // Save to localStorage
      localStorage.setItem('teamRange', JSON.stringify(newRange));
      const newTeams = Array.from({ length: endNum - startNum + 1 }, (_, i) => `Team ${i + startNum}`);
      setTeams(newTeams);
      // Reset all state to avoid issues with removed teams
      setCurrentTeamsByJudge({});
      setScoresByJudge({});
      setSeenTeamsByJudge({});
      setScoreTableData({});
      setCurrentJudge("");
    }
  };

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

        console.log('Loaded seen teams from backend:', newSeenTeams);

        // Merge fetched judges with localStorage judges
        const mergedJudges = [...new Set([...judges, ...sortedJudges])].sort((a, b) => a.localeCompare(b));
        setJudges(mergedJudges);
        setScoreTableData(newScoreTable);
        setSeenTeamsByJudge(newSeenTeams);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Only run once on mount

  // Assign teams when judge is selected
  useEffect(() => {
    if (currentJudge) {
      const currentTeams = currentTeamsByJudge[currentJudge] || [];
      const needsNewTeams = currentTeams.length < 5;

      if (!currentTeamsByJudge[currentJudge] || needsNewTeams) {
        const judgeSeenTeams = seenTeamsByJudge[currentJudge] || [];
        const teamsToAssign = getTeamsToAssign(teams, seenTeamsByJudge, judgeSeenTeams, currentTeamsByJudge, currentJudge);
        
        if (teamsToAssign.length > 0) {
          setCurrentTeamsByJudge(prev => ({ ...prev, [currentJudge]: teamsToAssign }));
          setScoresByJudge(prev => ({ ...prev, [currentJudge]: Array(teamsToAssign.length).fill("") }));
        }
      }
    }
  }, [currentJudge]); // Only run when currentJudge changes

  const handleJudgeChange = async (event) => {
    const selectedJudge = event.target.value;
    if (!selectedJudge) {
      setCurrentJudge("");
      return;
    }

    setIsAssigningTeams(true);
    setCurrentJudge(selectedJudge);

    // Check if judge has teams assigned and if they have fewer than 5 teams
    const currentTeams = currentTeamsByJudge[selectedJudge] || [];
    const needsNewTeams = currentTeams.length < 5;

    if (!currentTeamsByJudge[selectedJudge] || needsNewTeams) {
      const judgeSeenTeams = seenTeamsByJudge[selectedJudge] || [];
      const teamsToAssign = getTeamsToAssign(teams, seenTeamsByJudge, judgeSeenTeams, currentTeamsByJudge, selectedJudge);
      
      if (teamsToAssign.length > 0) {
        setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: teamsToAssign }));
        setScoresByJudge(prev => ({ ...prev, [selectedJudge]: Array(teamsToAssign.length).fill("") }));
      }
    }
    
    // Add a small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsAssigningTeams(false);
  };

  const addNewJudge = async () => {
    const newJudge = prompt("Enter your name:");
    if (!newJudge || judges.some(j => j.toLowerCase() === newJudge.toLowerCase())) return;

    try {
      // Add judge to state (maintaining sort)
      const updatedJudges = [...judges, newJudge].sort((a, b) => a.localeCompare(b));
      setJudges(updatedJudges);
      
      // Check if there are any unseen teams
      const judgeSeenTeams = seenTeamsByJudge[newJudge] || [];
      const teamsToAssign = getTeamsToAssign(teams, seenTeamsByJudge, judgeSeenTeams, currentTeamsByJudge, newJudge);
      
      // Only assign teams if there are teams to assign
      if (teamsToAssign.length > 0) {
        setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: teamsToAssign }));
        setScoresByJudge(prev => ({ ...prev, [newJudge]: Array(teamsToAssign.length).fill("") }));
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
      console.log("Error handled silently:", error);
    }
  };

  const handleScoreChange = (index, value) => {
    // Only update if the value is empty or a valid number between 0 and 3
    if (value === "" || (parseFloat(value) >= 0 && parseFloat(value) <= 3)) {
      setScoresByJudge(prev => ({
        ...prev,
        [currentJudge]: prev[currentJudge].map((score, i) => 
          i === index ? value : score
        )
      }));
    }
  };

  const handleSubmit = async () => {
    if (!currentJudge) return;

    try {
      const currentTeams = currentTeamsByJudge[currentJudge];
      const currentScores = scoresByJudge[currentJudge];
      
      if (!currentTeams || !currentScores) {
        console.error("No teams or scores found for current judge");
        return;
      }

      // Get only the teams that have scores
      const teamsWithScores = currentTeams.filter((_, index) => currentScores[index] !== "");
      const validScores = currentScores.filter(score => score !== "");
      
      // Validate that all assigned teams have scores
      if (teamsWithScores.length !== currentTeams.length) {
        alert("Please provide scores for all assigned teams before submitting.");
        return;
      }

      // Clear UI state immediately
      setCurrentTeamsByJudge({});
      setScoresByJudge({});
      setCurrentJudge("");
      
      console.log('Submitting scores for teams:', teamsWithScores);
      
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
      setSeenTeamsByJudge(prev => {
        const updated = { ...prev };
        if (!updated[currentJudge]) {
          updated[currentJudge] = [];
        }
        // Add only teams that were successfully scored
        teamsWithScores.forEach(team => {
          if (!updated[currentJudge].includes(team)) {
            updated[currentJudge].push(team);
          }
        });
        console.log('Updated seen teams for judge:', currentJudge, updated[currentJudge]);
        return updated;
      });

      // Clear localStorage for current teams and scores
      localStorage.removeItem('currentTeamsByJudge');
      localStorage.removeItem('scoresByJudge');

      // Show success message
      alert("Scores submitted successfully!");
    } catch (error) {
      console.error("Error submitting scores:", error);
      alert("An error occurred while submitting scores. Please try again.");
    }
  };

  // Update the useEffect for seen teams to properly handle localStorage
  useEffect(() => {
    if (Object.keys(seenTeamsByJudge).length > 0) {
      localStorage.setItem('seenTeamsByJudge', JSON.stringify(seenTeamsByJudge));
    } else {
      localStorage.removeItem('seenTeamsByJudge');
    }
  }, [seenTeamsByJudge]);

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
              {isAssigningTeams ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #1b2d3f',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ marginTop: '10px' }}>Assigning teams...</div>
                </div>
              ) : (
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmit();
                            }
                          }}
                          required
                        />
                      </div>
                    ))}
                </div>
              )}

              <button type="submit" className="submit-btn">
                Submit Scores ({currentTeamsByJudge[currentJudge]?.length || 0} teams)
              </button>
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

// Add the spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default App;
