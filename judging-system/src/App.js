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
  const [scoreTableData, setScoreTableData] = useState({});
  const [judges, setJudges] = useState([]);
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

        const uniqueJudges = [...new Set(data.map(score => score.judge_id))].sort();
        console.log("Setting initial judges:", uniqueJudges);
        setJudges(uniqueJudges);

        const updatedData = {};
        teams.forEach(team => {
          updatedData[team] = {};
          uniqueJudges.forEach(judge => {
            updatedData[team][judge] = "";
          });
        });

        data.forEach(({ team_id, judge_id, score }) => {
          if (!updatedData[team_id]) {
            updatedData[team_id] = {};
          }
          updatedData[team_id][judge_id] = score;
        });

        console.log("Setting score table data:", updatedData);
        setScoreTableData(updatedData);
      } catch (error) {
        console.error("Error loading initial data:", error);
        alert("Failed to load initial data. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const updateScore = async (team, judge, newScore) => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/scores`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ judge_id: judge, team_id: team, score: newScore })
        });

        if (!response.ok) {
            throw new Error(`Failed to submit score: ${await response.text()}`);
        }

        setScoreTableData(prevData => ({
            ...prevData,
            [team]: {
                ...prevData[team],
                [judge]: newScore
            }
        }));
    } catch (error) {
        console.error("Error submitting score:", error);
        alert("Failed to submit score.");
    }
};

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>
      {isLoading ? (
        <div>Loading judges and scores...</div>
      ) : (
        <>
          <h2>Score Table</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  {judges.map(judge => <th key={judge}>{judge}</th>)}
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => {
                  const teamScores = scoreTableData[team] || {};
                  return (
                    <tr key={team}>
                      <td>{team}</td>
                      {judges.map(judge => <td key={`${team}-${judge}`}>{teamScores[judge] || ""}</td>)}
                      <td>{
                        Object.values(teamScores).length > 0 ? 
                        (Object.values(teamScores).reduce((sum, score) => sum + (parseFloat(score) || 0), 0) / Object.values(teamScores).length).toFixed(2) : ""
                      }</td>
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
