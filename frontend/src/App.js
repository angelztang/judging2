import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api'
  : 'http://localhost:5000/api';

function App() {
  const [judges, setJudges] = useState([]);
  const [selectedJudge, setSelectedJudge] = useState('');
  const [startTeam, setStartTeam] = useState(1);
  const [endTeam, setEndTeam] = useState(10);
  const [scores, setScores] = useState([]);
  const [currentTeams, setCurrentTeams] = useState([]);
  const [teamScores, setTeamScores] = useState({});

  const handleAddJudge = () => {
    const judgeName = prompt('Enter judge name:');
    if (judgeName) {
      setJudges([...judges, judgeName]);
    }
  };

  const handleGenerateTeams = async () => {
    try {
      const response = await axios.get(`${API_URL}/generate_teams`, {
        params: {
          judge: selectedJudge,
          start: startTeam,
          end: endTeam
        }
      });
      setCurrentTeams(response.data.teams);
      const initialScores = {};
      response.data.teams.forEach(team => {
        initialScores[team] = '';
      });
      setTeamScores(initialScores);
    } catch (error) {
      console.error('Error generating teams:', error);
      alert('Failed to generate teams. Please try again.');
    }
  };

  const handleScoreChange = (team, score) => {
    setTeamScores(prev => ({
      ...prev,
      [team]: score
    }));
  };

  const handleSubmitScores = async () => {
    try {
      const promises = Object.entries(teamScores).map(([team, score]) => {
        if (score !== '') {
          return axios.post(`${API_URL}/scores`, {
            judge_id: selectedJudge,
            team_id: team,
            score: parseFloat(score)
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      alert('Scores submitted successfully!');
      setTeamScores({});
      setCurrentTeams([]);
      fetchScores();
    } catch (error) {
      console.error('Error submitting scores:', error);
      alert('Failed to submit scores. Please try again.');
    }
  };

  const fetchScores = async () => {
    try {
      const response = await axios.get(`${API_URL}/scores`);
      setScores(response.data);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // Calculate average scores for each team
  const averageScores = scores.reduce((acc, score) => {
    if (!acc[score.team_id]) {
      acc[score.team_id] = { total: 0, count: 0 };
    }
    acc[score.team_id].total += score.score;
    acc[score.team_id].count += 1;
    return acc;
  }, {});

  const sortedTeams = Object.entries(averageScores)
    .map(([team, data]) => ({
      team,
      average: data.total / data.count
    }))
    .sort((a, b) => b.average - a.average);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ color: 'white' }}>
        Hackathon Judging System
      </Typography>

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Select Judge</InputLabel>
          <Select
            value={selectedJudge}
            onChange={(e) => setSelectedJudge(e.target.value)}
            label="Select Judge"
          >
            {judges.map((judge) => (
              <MenuItem key={judge} value={judge}>{judge}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" color="primary" onClick={handleAddJudge}>
          + Add New Judge
        </Button>
      </Box>

      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <TextField
          label="Start Team"
          type="number"
          value={startTeam}
          onChange={(e) => setStartTeam(parseInt(e.target.value))}
          sx={{ width: '150px' }}
        />
        <TextField
          label="End Team"
          type="number"
          value={endTeam}
          onChange={(e) => setEndTeam(parseInt(e.target.value))}
          sx={{ width: '150px' }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleGenerateTeams}
          disabled={!selectedJudge}
          sx={{ flexGrow: 1 }}
        >
          Generate Teams
        </Button>
      </Box>

      {currentTeams.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
            Score Teams
          </Typography>
          {currentTeams.map((team) => (
            <Box key={team} sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography sx={{ width: '100px', color: 'white' }}>Team {team}:</Typography>
              <TextField
                type="number"
                value={teamScores[team]}
                onChange={(e) => handleScoreChange(team, e.target.value)}
                inputProps={{ min: 1, max: 5, step: 0.1 }}
                sx={{ width: '150px' }}
              />
            </Box>
          ))}
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmitScores}
            sx={{ mt: 2 }}
          >
            Submit Scores
          </Button>
        </Box>
      )}

      <Typography variant="h5" gutterBottom sx={{ mt: 4, color: 'white' }}>
        Score Table
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Team</TableCell>
              <TableCell align="right">Average</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedTeams.map(({ team, average }) => (
              <TableRow key={team}>
                <TableCell>Team {team}</TableCell>
                <TableCell align="right">{average.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
