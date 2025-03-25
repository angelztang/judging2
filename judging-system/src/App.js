import React, { useState, useEffect } from "react";
import "./App1.css";

const teams = Array.from({ length: 20 }, (_, i) => `Team ${i + 1}`);
const BACKEND_URL = 'https://judging-system-a20f58757cfa.herokuapp.com';

const getWeightedRandomTeams = (availableTeams, seenTeams, count) => {
  let candidates = availableTeams.filter(team => !seenTeams.includes(team));
  candidates.sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));

  let selected = new Set();
  while (selected.size < count && candidates.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    selected.add(candidates[randomIndex]);
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
  const [isLoading, setIsLoading] = useState(true);

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
        const scoresData = await scoresRes.json();

        // Set judges
        setJudges(judgesData);

        // Initialize score table
        const scoreTable = {};
        teams.forEach(team => {
          scoreTable[team] = {};
          judgesData.forEach(judge => {
            scoreTable[team][judge] = "";
          });
        });

        // Fill in existing scores
        scoresData.forEach(({ team_id, judge_id, score }) => {
          if (!scoreTable[team_id]) scoreTable[team_id] = {};
          scoreTable[team_id][judge_id] = score;
        });
        setScoreTableData(scoreTable);

        // Set seen teams
        const seenTeams = {};
        judgesData.forEach(judge => {
          seenTeams[judge] = scoresData
            .filter(score => score.judge_id === judge)
            .map(score => score.team_id);
        });
        setSeenTeamsByJudge(seenTeams);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
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
    setCurrentJudge(event.target.value);
  };

  const addNewJudge = async () => {
    const newJudge = prompt("Enter your name:");
    if (!newJudge || judges.includes(newJudge)) return;

    try {
      // Add judge to state immediately
      setJudges(prev => [...prev, newJudge]);
      setCurrentJudge(newJudge);

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
    }
  };

  const handleScoreChange = (index, value) => {
    setScoresByJudge(prev => ({
      ...prev,
      [currentJudge]: prev[currentJudge].map((score, i) => 
        i === index ? value : score
      )
    }));
  };

  const handleSubmit = async () => {
    if (!currentJudge) return;

    const currentTeams = currentTeamsByJudge[currentJudge];
    const currentScores = scoresByJudge[currentJudge];

    try {
      // Submit all scores
      await Promise.all(currentTeams.map((team, index) => 
        fetch(`${BACKEND_URL}/api/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            judge_id: currentJudge,
            team_id: team,
            score: parseFloat(currentScores[index])
          })
        })
      ));

      // Update seen teams
      setSeenTeamsByJudge(prev => ({
        ...prev,
        [currentJudge]: [...(prev[currentJudge] || []), ...currentTeams]
      }));

      // Assign new teams
      const newTeams = getWeightedRandomTeams(teams, seenTeamsByJudge[currentJudge] || [], 5);
      setCurrentTeamsByJudge(prev => ({ ...prev, [currentJudge]: newTeams }));
      setScoresByJudge(prev => ({ ...prev, [currentJudge]: Array(5).fill("") }));

      alert('Scores submitted successfully!');
    } catch (error) {
      console.error("Error submitting scores:", error);
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
            <select value={currentJudge} onChange={handleJudgeChange}>
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
          <table>
            <thead>
              <tr>
                <th>Team</th>
                {judges.map(judge => <th key={judge}>{judge}</th>)}
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team}>
                  <td>{team}</td>
                  {judges.map(judge => (
                    <td key={`${team}-${judge}`}>
                      {scoreTableData[team]?.[judge] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default App;
