import React, { useState, useEffect } from "react";
import "./App1.css";  // Make sure to create this CSS file

const teams = Array.from({ length: 20 }, (_, i) => `Team ${i + 1}`);

const getWeightedRandomTeams = (availableTeams, seenTeams, count, teamAssignments, judgedTeams) => {
  let unjudgedTeams = availableTeams.filter((team) => !judgedTeams.has(team));
  let judgedTeamsList = availableTeams.filter((team) => judgedTeams.has(team));

  let candidates = [...unjudgedTeams, ...judgedTeamsList].filter((team) => !seenTeams.includes(team));

  candidates.sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));

  let selected = new Set();
  let baseIndex = Math.floor(Math.random() * (candidates.length - 7));
  while (selected.size < count) {
    let randomOffset = Math.floor(Math.random() * 7); 
    let team = candidates[Math.min(baseIndex + randomOffset, candidates.length - 1)];
    if (!selected.has(team) && (teamAssignments[team] || 0) < Math.min(...Object.values(teamAssignments)) + 1) {
      selected.add(team);
    }
  }

  return Array.from(selected);
};

const BACKEND_URL = 'https://judging-system-a20f58757cfa.herokuapp.com';

function App() {
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState({});
  const [scoresByJudge, setScoresByJudge] = useState({});
  const [judges, setJudges] = useState([]);
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [teamAssignments, setTeamAssignments] = useState({});
  const [judgedTeams, setJudgedTeams] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching initial data...");
        const response = await fetch(`${BACKEND_URL}/api/scores`);
        if (!response.ok) {
          throw new Error(`Failed to fetch scores: ${await response.text()}`);
        }
        const data = await response.json();
        console.log("Received initial data:", data);

        // Extract and set judges immediately
        const uniqueJudges = [...new Set(data.map(score => score.judge_id))].sort();
        console.log("Setting initial judges:", uniqueJudges);
        setJudges(uniqueJudges);

        // Initialize score table
        const updatedData = {};
        teams.forEach(team => {
          updatedData[team] = {};
          uniqueJudges.forEach(judge => {
            updatedData[team][judge] = "";
          });
        });

        // Fill in scores
        data.forEach(({ team_id, judge_id, score }) => {
          if (!updatedData[team_id]) {
            updatedData[team_id] = {};
          }
          updatedData[team_id][judge_id] = score;
        });

        setScoreTableData(updatedData);

        // Set seen teams
        const seenTeams = {};
        uniqueJudges.forEach(judge => {
          seenTeams[judge] = data
            .filter(score => score.judge_id === judge)
            .map(score => score.team_id);
        });
        setSeenTeamsByJudge(seenTeams);

        // Set team assignments
        const assignments = {};
        data.forEach(({ team_id }) => {
          assignments[team_id] = (assignments[team_id] || 0) + 1;
        });
        setTeamAssignments(assignments);

        // Set judged teams
        setJudgedTeams(new Set(data.map(score => score.team_id)));

      } catch (error) {
        console.error("Error loading initial data:", error);
        alert("Failed to load initial data. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentJudge && !currentTeamsByJudge[currentJudge]) {
      assignNewTeams(currentJudge);
    }
  }, [currentJudge, currentTeamsByJudge]);

  const assignNewTeams = (judge) => {
    const seenTeams = seenTeamsByJudge[judge] || [];
    const newTeams = getWeightedRandomTeams(teams, seenTeams, 5, teamAssignments, judgedTeams);
    setCurrentTeamsByJudge((prev) => ({ ...prev, [judge]: newTeams }));
    setScoresByJudge((prev) => ({ ...prev, [judge]: Array(5).fill("") }));
    setTeamAssignments((prev) => {
      const updatedAssignments = { ...prev };
      newTeams.forEach(team => {
        updatedAssignments[team] = (updatedAssignments[team] || 0) + 1;
      });
      return updatedAssignments;
    });

    setJudgedTeams((prev) => new Set([...prev, ...newTeams]));
  };

  const handleScoreChange = (index, value) => {
    setScoresByJudge((prev) => ({
      ...prev,
      [currentJudge]: prev[currentJudge].map((score, i) =>
        i === index ? value : score
      ),
    }));
  };

  const handleJudgeChange = (event) => {
    setCurrentJudge(event.target.value);
  };

  const addNewJudge = () => {
    const newJudge = prompt("Enter your name:");
    if (newJudge && !judges.includes(newJudge)) {
      setJudges([...judges, newJudge]);
      setCurrentJudge(newJudge);
    }
  };

  const handleSubmit = async () => {
    if (!currentJudge) {
      alert('Please select a judge first');
      return;
    }

    const currentTeams = currentTeamsByJudge[currentJudge] || [];
    const currentScores = scoresByJudge[currentJudge] || [];

    if (currentScores.some(score => score === "")) {
      alert('Please enter scores for all teams');
      return;
    }

    const invalidScores = currentScores.some(score => {
      const numScore = parseFloat(score);
      return isNaN(numScore) || numScore < 0 || numScore > 3;
    });

    if (invalidScores) {
      alert('Please enter valid scores between 0 and 3 for all teams');
      return;
    }

    try {
      const newData = currentTeams.map((team, index) => ({
        judge_id: currentJudge,
        team_id: team,
        score: parseFloat(currentScores[index])
      }));

      console.log('Submitting scores:', newData);
      
      await Promise.all(newData.map(submitScore));
      await fetchScores();

      setSeenTeamsByJudge(prev => ({
        ...prev,
        [currentJudge]: [...new Set([...(prev[currentJudge] || []), ...currentTeams])]
      }));

      assignNewTeams(currentJudge);
      
      alert('All scores submitted successfully!');
    } catch (error) {
      console.error('Error submitting scores:', error);
      alert('Failed to submit scores. Please try again. Error: ' + error.message);
    }
  };

  const calculateAverage = (teamScores) => {
    const totalScore = Object.values(teamScores).reduce(
      (sum, score) => sum + (parseFloat(score) || 0),
      0
    );
    const numJudges = Object.keys(teamScores).length;
    return numJudges > 0 ? (totalScore / numJudges).toFixed(2) : "";
  };

  const fetchScores = async () => {
    try {
      console.log("Fetching scores from:", `${BACKEND_URL}/api/scores`);
      const response = await fetch(`${BACKEND_URL}/api/scores`);
      if (!response.ok) {
        throw new Error(`Failed to fetch scores: ${await response.text()}`);
      }
      const data = await response.json();
      console.log("Received scores:", data);

      // Extract unique judges from the data
      const uniqueJudges = [...new Set(data.map(score => score.judge_id))].sort();
      console.log("Found judges:", uniqueJudges);

      // Update judges list
      setJudges(uniqueJudges);

      // Initialize score table with all teams and judges
      const updatedData = {};
      teams.forEach(team => {
        updatedData[team] = {};
        uniqueJudges.forEach(judge => {
          updatedData[team][judge] = "";
        });
      });

      // Fill in actual scores
      data.forEach(({ team_id, judge_id, score }) => {
        if (!updatedData[team_id]) {
          updatedData[team_id] = {};
        }
        updatedData[team_id][judge_id] = score;
      });

      console.log("Updated score table data:", updatedData);
      setScoreTableData(updatedData);

      // Update seen teams for each judge
      const seenTeamsByJudgeData = {};
      uniqueJudges.forEach(judge => {
        seenTeamsByJudgeData[judge] = data
          .filter(score => score.judge_id === judge)
          .map(score => score.team_id);
      });
      console.log("Seen teams by judge:", seenTeamsByJudgeData);
      setSeenTeamsByJudge(seenTeamsByJudgeData);

      // Update team assignments
      const teamAssignmentsData = {};
      data.forEach(({ team_id }) => {
        teamAssignmentsData[team_id] = (teamAssignmentsData[team_id] || 0) + 1;
      });
      setTeamAssignments(teamAssignmentsData);

      // Set judged teams
      setJudgedTeams(new Set(data.map(score => score.team_id)));

    } catch (error) {
      console.error("Error fetching scores:", error);
      alert("Failed to fetch scores. Please refresh the page.");
    }
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      {isLoading ? (
        <div>Loading judges and scores...</div>
      ) : (
        <>
          <div className="select-container">
            <label>Select Judge: </label>
            <select value={currentJudge} onChange={handleJudgeChange}>
              <option value="">Select a judge</option>
              {judges.map((judge) => (
                <option key={judge} value={judge}>
                  {judge}
                </option>
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
                  placeholder="Enter score (0-3)"
                  value={scoresByJudge[currentJudge]?.[index] || ""}
                  onChange={(e) => handleScoreChange(index, e.target.value)}
                  className="score-input"
                />
              </div>
            ))}
          </div>

          {currentJudge && currentTeamsByJudge[currentJudge]?.length > 0 && (
            <button 
              onClick={handleSubmit} 
              className="submit-btn"
            >
              Submit Scores
            </button>
          )}

          <h2>Score Table</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  {judges.map((judge) => (
                    <th key={judge}>{judge}</th>
                  ))}
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {teams
                  .sort((a, b) => {
                    const numA = parseInt(a.split(' ')[1]);
                    const numB = parseInt(b.split(' ')[1]);
                    return numA - numB;
                  })
                  .map(team => {
                    const teamScores = scoreTableData[team] || {};
                    return (
                      <tr key={team}>
                        <td>{team}</td>
                        {judges.map((judge) => (
                          <td key={`${team}-${judge}`}>
                            {teamScores[judge] || ""}
                          </td>
                        ))}
                        <td>{calculateAverage(teamScores)}</td>
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

const submitScore = async (scoreData) => {
  try {
    scoreData.score = parseFloat(scoreData.score);
    
    console.log("Submitting score to:", `${BACKEND_URL}/api/scores`);
    console.log("Score data:", JSON.stringify(scoreData, null, 2));
    
    const response = await fetch(`${BACKEND_URL}/api/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(scoreData),
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      throw new Error('Failed to parse response JSON');
    }

    console.log("Response status:", response.status);
    console.log("Response data:", responseData);

    if (response.status === 201 || response.status === 200) {
      console.log("Score submitted/updated successfully!");
      return true;
    }

    throw new Error(responseData.error || 'Failed to submit score');
  } catch (error) {
    console.error("Error submitting score:", error);
    console.error("Error details:", error.message);
    throw error;
  }
};

export default App;
