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

        // Initialize score table with existing scores
        const newScoreTable = {};
        teams.forEach(team => {
          newScoreTable[team] = {};
        });

        // Track seen teams and fill score table
        const newSeenTeams = {};
        scoresData.forEach(({ team_id, judge_id, score }) => {
          if (!newScoreTable[team_id]) newScoreTable[team_id] = {};
          newScoreTable[team_id][judge_id] = score;
          
          if (!newSeenTeams[judge_id]) newSeenTeams[judge_id] = [];
          if (!newSeenTeams[judge_id].includes(team_id)) {
            newSeenTeams[judge_id].push(team_id);
          }
        });

        setJudges(judgesData);
        setScoreTableData(newScoreTable);
        setSeenTeamsByJudge(newSeenTeams);
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
              judge_id: currentJudge,
              team_id: team,
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
