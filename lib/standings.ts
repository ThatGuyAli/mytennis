import { getLeagueScoringRuleByNumber } from "@/lib/league-scoring-rules";

type StandingPlayer = {
  id: string;
  name: string;
};

type StandingMatch = {
  id: string;
  player1_id: string;
  player2_id: string;
};

type StandingSet = {
  match_id: string;
  set_number: number;
  player1_games: number;
  player2_games: number;
  is_tiebreak: boolean;
};

export type ComputedStandingRow = {
  position: number;
  player_id: string;
  player_name: string;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  sets_won: number;
  sets_lost: number;
  points: number;
  win_percentage: number;
  loss_percentage: number;
};

type MutableStanding = Omit<ComputedStandingRow, "position">;

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildLeagueStandings(
  players: StandingPlayer[],
  matches: StandingMatch[],
  sets: StandingSet[],
  scoringRuleType: number,
): ComputedStandingRow[] {
  const scoringRule = getLeagueScoringRuleByNumber(scoringRuleType);
  const setsByMatch = new Map<string, StandingSet[]>();
  for (const set of sets) {
    const current = setsByMatch.get(set.match_id) ?? [];
    current.push(set);
    setsByMatch.set(set.match_id, current);
  }

  const standings = new Map<string, MutableStanding>();
  for (const player of players) {
    standings.set(player.id, {
      player_id: player.id,
      player_name: player.name,
      matches_played: 0,
      matches_won: 0,
      matches_lost: 0,
      matches_drawn: 0,
      sets_won: 0,
      sets_lost: 0,
      points: 0,
      win_percentage: 0,
      loss_percentage: 0,
    });
  }

  for (const match of matches) {
    const p1 = standings.get(match.player1_id);
    const p2 = standings.get(match.player2_id);
    if (!p1 || !p2) continue;

    const matchSets = (setsByMatch.get(match.id) ?? []).slice().sort((a, b) => a.set_number - b.set_number);
    if (matchSets.length === 0) continue;

    let p1SetWins = 0;
    let p2SetWins = 0;
    let p1GamesWon = 0;
    let p2GamesWon = 0;
    let hasTieBreakSet = false;

    for (const set of matchSets) {
      p1GamesWon += set.player1_games;
      p2GamesWon += set.player2_games;
      if (set.player1_games > set.player2_games) p1SetWins += 1;
      if (set.player2_games > set.player1_games) p2SetWins += 1;
      if (set.is_tiebreak) hasTieBreakSet = true;
    }

    p1.matches_played += 1;
    p2.matches_played += 1;
    p1.sets_won += p1SetWins;
    p1.sets_lost += p2SetWins;
    p2.sets_won += p2SetWins;
    p2.sets_lost += p1SetWins;

    if (p1SetWins > p2SetWins) {
      p1.matches_won += 1;
      p2.matches_lost += 1;
      p1.points += scoringRule.getWinnerPoints({ hasTieBreakSet });
      p2.points += scoringRule.getLoserPoints({
        hasTieBreakSet,
        totalGamesWon: p2GamesWon,
      });
      continue;
    }

    if (p2SetWins > p1SetWins) {
      p2.matches_won += 1;
      p1.matches_lost += 1;
      p2.points += scoringRule.getWinnerPoints({ hasTieBreakSet });
      p1.points += scoringRule.getLoserPoints({
        hasTieBreakSet,
        totalGamesWon: p1GamesWon,
      });
      continue;
    }

    p1.matches_drawn += 1;
    p2.matches_drawn += 1;
    const drawPoints = scoringRule.getDrawPoints();
    p1.points += drawPoints;
    p2.points += drawPoints;
  }

  const rows = Array.from(standings.values()).map((row) => {
    const matchesPlayed = row.matches_played;
    return {
      ...row,
      points: roundTo2(row.points),
      win_percentage: matchesPlayed > 0 ? roundTo2((row.matches_won / matchesPlayed) * 100) : 0,
      loss_percentage: matchesPlayed > 0 ? roundTo2((row.matches_lost / matchesPlayed) * 100) : 0,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aSetDiff = a.sets_won - a.sets_lost;
    const bSetDiff = b.sets_won - b.sets_lost;
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
    if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
    return a.player_name.localeCompare(b.player_name);
  });

  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}
