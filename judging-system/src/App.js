import React, { useState, useEffect } from "react";
import "./App1.css";  // Make sure to create this CSS file

const teams = Array.from({ length: 5 }, (_, i) => `Team ${i + 1}`);

const getRandomTeams = (availableTeams, seenTeams, count) => {
  let candidates = availableTeams.filter((team) => !seenTeams.includes(team));
  if (candidates.length < count) candidates = availableTeams;

  const selected = new Set();
  while (selected.size < count) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    selected.add(candidates[randomIndex]);
  }
  return Array.from(selected);
};

function App() {
  const [currentTeams, setCurrentTeams] = useState([]);
  const [scores, setScores] = useState(Array(5).fill(""));
  const [judges, setJudges] = useState([]); // Initially empty, judges add themselves
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});

  useEffect(() => {
    assignNewTeams();
  }, [currentJudge]);

  // Assign new random teams for the current judge
  const assignNewTeams = () => {
    const seenTeams = seenTeamsByJudge[currentJudge] || [];
    setCurrentTeams(getRandomTeams(teams, seenTeams, 5));
  };

  // Handle score changes
  const handleScoreChange = (index, value) => {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
  };

  // Handle judge selection
  const handleJudgeChange = (event) => {
    setCurrentJudge(event.target.value);
  };

  // Add a new judge
  const addNewJudge = () => {
    const newJudge = prompt("Enter your name:");
    if (newJudge && !judges.includes(newJudge)) {
      setJudges([...judges, newJudge]);
      setCurrentJudge(newJudge);
    }
  };

  // Submit scores and update the score table
  const handleSubmit = () => {
    if (!currentJudge) return;

    // Collect new scores data
    const newData = currentTeams.map((team, index) => ({
      Team: team,
      Judge: currentJudge,
      Score: scores[index],
    }));

    // Add new scores to existing score table data
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

    // Update seen teams for the current judge
    const updatedSeenTeams = [
      ...(seenTeamsByJudge[currentJudge] || []),
      ...currentTeams,
    ];
    setSeenTeamsByJudge({
      ...seenTeamsByJudge,
      [currentJudge]: updatedSeenTeams,
    });

    // Clear the score inputs and assign new teams
    setScores(Array(5).fill(""));
    assignNewTeams();
  };

  // Calculate average scores for each team
  const calculateAverage = (teamScores) => {
    const totalScore = Object.values(teamScores).reduce(
      (sum, score) => sum + (parseFloat(score) || 0),
      0
    );
    const numJudges = Object.keys(teamScores).length;
    return numJudges > 0 ? totalScore / numJudges : 0;
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      {/* Judge Selector */}
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

      {/* Team Inputs */}
      <div className="team-inputs">
        {currentTeams.map((team, index) => (
          <div key={team} className="team-input">
            <span>{team}</span>
            <input
              type="number"
              placeholder="Enter score"
              value={scores[index]}
              onChange={(e) => handleScoreChange(index, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <button onClick={handleSubmit} className="submit-btn">
        Submit Scores
      </button>

      {/* Score Table */}
      {/* Score Table */}
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
          <td>{calculateAverage(teamScores) || ""}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

    </div>
  );
}

export default App;
