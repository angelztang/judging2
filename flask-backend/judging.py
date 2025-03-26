import random
import itertools
from collections import defaultdict
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

num_judges = 30
num_teams = 100
num_rooms = 10
teams_per_group = 5
max_rounds = 2

teams = list(range(1, num_teams + 1))
judges = list(range(1, num_judges + 1))
rooms = {i: [] for i in range(1, num_rooms + 1)}

random.shuffle(teams)
team_groups = [teams[i:i + teams_per_group] for i in range(0, len(teams), teams_per_group)]

for i, group in enumerate(team_groups):
    room_num = (i % num_rooms) + 1
    rooms[room_num].append(group)

judge_assignments = defaultdict(list)
teams_judged_count = defaultdict(int)

def get_next_teams(judge):
    """ Selects the next 5 teams for a judge to evaluate fairly. """
    available_teams = sorted(teams, key=lambda t: teams_judged_count[t])
    next_teams = available_teams[:teams_per_group]
    for team in next_teams:
        teams_judged_count[team] += 1
    return next_teams

judge_next_teams = {judge: get_next_teams(judge) for judge in judges}

# @app.route('/')
# def index():
#     return render_template('index.html', judges=judges, judge_next_teams=judge_next_teams, num_judges=num_judges)

@app.route('/hackathon_judging')
def hackathon_judging():
    # A list of judges (this can come from a database or an API)
    judges = ['Judge Alice', 'Judge Bob', 'Judge Charlie', 'Judge David', 'Judge Emma']
    
    # Example of the next teams for each judge
    judge_next_teams = {
        1: ['Team A', 'Team B', 'Team C'],
        2: ['Team D', 'Team E', 'Team F'],
        3: ['Team G', 'Team H', 'Team I'],
        4: ['Team J', 'Team K', 'Team L'],
        5: ['Team M', 'Team N', 'Team O']
    }
    
    return render_template('judging_form.html', judges=judges, judge_next_teams=judge_next_teams)


@app.route('/update_judges', methods=['POST'])
def update_judges():
    global num_judges, judges, judge_next_teams
    num_judges = int(request.form['num_judges'])
    judges = list(range(1, num_judges + 1))
    judge_next_teams = {judge: get_next_teams(judge) for judge in judges}
    return redirect(url_for('index'))

@app.route('/submit_scores', methods=['POST'])
def submit_scores():
    judge = int(request.form['judge'])
    scores = {int(team): int(request.form[f'score_{team}']) for team in judge_next_teams[judge]}
    judge_assignments[judge].append(scores)
    judge_next_teams[judge] = get_next_teams(judge)
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
