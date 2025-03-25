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
  const [judgedTeams, setJudgedTeams] = useState(new Set()); // Track judged teams

  useEffect(() => {
    if (currentJudge && !currentTeamsByJudge[currentJudge]) {
      assignNewTeams(currentJudge);
    }
  }, [currentJudge]);

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

    // Update judged teams set
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

    // Check if we have all scores
    if (currentScores.some(score => score === "")) {
      alert('Please enter scores for all teams');
      return;
    }

    // Validate scores
    const invalidScores = currentScores.some(score => {
      const numScore = parseFloat(score);
      return isNaN(numScore) || numScore < 0 || numScore > 10;
    });

    if (invalidScores) {
      alert('Please enter valid scores between 0 and 10 for all teams');
      return;
    }

    const newData = currentTeams.map((team, index) => {
      const existingScore = scoreTableData[team]?.[currentJudge];
      const score = existingScore !== undefined ? existingScore : parseFloat(currentScores[index]);
      return {
        judge_id: currentJudge,
        team_id: team,
        score: score
      };
    });

    try {
      console.log('Submitting scores:', newData);
      // Submit the score data to the backend
      await Promise.all(newData.map(submitScore));

      // Fetch updated scores from the backend
      await fetchScores();

      setSeenTeamsByJudge((prev) => ({
        ...prev,
        [currentJudge]: [...(prev[currentJudge] || []), ...currentTeams],
      }));

      assignNewTeams(currentJudge);
      alert('Scores submitted successfully!');
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

  // Fetch scores when component mounts
  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      console.log("Fetching scores from:", `${BACKEND_URL}/api/scores`);
      const response = await fetch(`${BACKEND_URL}/api/scores`);
      if (!response.ok) {
        throw new Error(`Failed to fetch scores: ${await response.text()}`);
      }
      const data = await response.json();
      console.log("Received scores:", data);

      // Update the scoreTableData with the fetched scores
      const updatedData = {};
      data.forEach((scoreEntry) => {
        const { team_id, judge_id, score } = scoreEntry;
        if (!updatedData[team_id]) updatedData[team_id] = {};
        updatedData[team_id][judge_id] = score;
        
        // Add judge to judges list if not already present
        if (!judges.includes(judge_id)) {
          setJudges(prev => [...prev, judge_id]);
        }
      });
      console.log("Updated score table data:", updatedData);
      setScoreTableData(updatedData);
    } catch (error) {
      console.error("Error fetching scores:", error);
      alert("Failed to fetch scores. Please refresh the page.");
    }
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      <div className="select-container">
        <label>Select Judge: </label>
        <select value={currentJudge} onChange={handleJudgeChange}>
          {judges.length === 0 ? (
            <option value="">No judges yet</option>
          ) : (
            judges.map((judge) => (
              <option key={judge} value={judge}>
                {judge}
              </option>
            ))
          )}
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
              placeholder="Enter score"
              value={scoresByJudge[currentJudge]?.[index] || ""}
              onChange={(e) => handleScoreChange(index, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} className="submit-btn">
        Submit Scores
      </button>

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
            {Object.entries(scoreTableData).map(([team, teamScores]) => (
              <tr key={team}>
                <td>{team}</td>
                {judges.map((judge) => (
                  <td key={`${team}-${judge}`}>{teamScores[judge] || ""}</td>
                ))}
                <td>{calculateAverage(teamScores)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const submitScore = async (scoreData) => {
  try {
    // Ensure score is a number
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

    const responseText = await response.text();
    console.log("Response status:", response.status);
    console.log("Response text:", responseText);

    if (!response.ok) {
      throw new Error(`Failed to submit score: ${responseText}`);
    }

    console.log("Score submitted successfully!");
  } catch (error) {
    console.error("Error submitting score:", error);
    console.error("Error details:", error.message);
    throw error; // Re-throw to be caught by handleSubmit
  }
};

export default App;
