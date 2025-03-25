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

  const handleSubmit = () => {
    if (!currentJudge) return;

    const currentTeams = currentTeamsByJudge[currentJudge] || [];
    const currentScores = scoresByJudge[currentJudge] || [];

    // Check if the team has already been judged by this judge
    const newData = currentTeams.map((team, index) => {
      const existingScore = scoreTableData[team]?.[currentJudge];
      // If there's already a score for this team by the current judge, discard the new score
      if (existingScore !== undefined) {
        return {
          Team: team,
          Judge: currentJudge,
          Score: existingScore, // Keep the existing score
        };
      } else {
        return {
          Team: team,
          Judge: currentJudge,
          Score: currentScores[index], // Use the new score if it's the first time
        };
      }
    });

    setScoreTableData((prevData) => {
      const updatedData = { ...prevData };

      newData.forEach(({ Team, Judge, Score }) => {
        if (!updatedData[Team]) {
          updatedData[Team] = {};
        }
        updatedData[Team][Judge] = Score;
      });

      return updatedData;
    });

    setSeenTeamsByJudge((prev) => ({
      ...prev,
      [currentJudge]: [...(prev[currentJudge] || []), ...currentTeams],
    }));

    assignNewTeams(currentJudge);
  };

  const calculateAverage = (teamScores) => {
    const totalScore = Object.values(teamScores).reduce(
      (sum, score) => sum + (parseFloat(score) || 0),
      0
    );
    const numJudges = Object.keys(teamScores).length;
    return numJudges > 0 ? (totalScore / numJudges).toFixed(2) : "";
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
    const response = await fetch('https://judging-system-a20f58757cfa.herokuapp.com//api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scoreData),
    });

    if (response.ok) {
      console.log("Score submitted successfully!");
    } else {
      console.error("Failed to submit score");
    }
  } catch (error) {
    console.error("Error submitting score:", error);
  }
};

const fetchScores = async () => {
  try {
    const response = await fetch('https://judging-system-a20f58757cfa.herokuapp.com//api/scores');
    const data = await response.json();
    console.log(data); // Use the data to populate the UI
  } catch (error) {
    console.error("Error fetching scores:", error);
  }
};


export default App;
