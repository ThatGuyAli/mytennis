export enum LeagueScoringRuleType {
  SIMPLE = 1,
  WEIGHTED_TIEBREAK = 2,
}

export type WinnerPointsContext = {
  hasTieBreakSet: boolean;
};

export type LoserPointsContext = {
  hasTieBreakSet: boolean;
  totalGamesWon: number;
};

export type LeagueScoringRule = {
  type: LeagueScoringRuleType;
  label: string;
  getWinnerPoints: (context: WinnerPointsContext) => number;
  getLoserPoints: (context: LoserPointsContext) => number;
  getDrawPoints: () => number;
};

function weightedLoserPointsWithoutTieBreak(totalGamesWon: number) {
  if (totalGamesWon <= 0) return 0;
  if (totalGamesWon === 1) return 0.5;
  if (totalGamesWon <= 3) return 1;
  if (totalGamesWon <= 8) return 1.5;
  return 2;
}

export const LEAGUE_SCORING_RULES: Record<LeagueScoringRuleType, LeagueScoringRule> = {
  [LeagueScoringRuleType.SIMPLE]: {
    type: LeagueScoringRuleType.SIMPLE,
    label: "Simple (3/0, draw 1)",
    getWinnerPoints: () => 3,
    getLoserPoints: () => 0,
    getDrawPoints: () => 1,
  },
  [LeagueScoringRuleType.WEIGHTED_TIEBREAK]: {
    type: LeagueScoringRuleType.WEIGHTED_TIEBREAK,
    label: "Weighted Tie-break",
    getWinnerPoints: (context) => (context.hasTieBreakSet ? 4 : 5),
    getLoserPoints: (context) =>
      context.hasTieBreakSet ? 3 : weightedLoserPointsWithoutTieBreak(context.totalGamesWon),
    getDrawPoints: () => 2.5,
  },
};

export function getLeagueScoringRule(ruleType: LeagueScoringRuleType) {
  return LEAGUE_SCORING_RULES[ruleType];
}

export function getLeagueScoringRuleByNumber(ruleType: number) {
  if (ruleType === LeagueScoringRuleType.WEIGHTED_TIEBREAK) {
    return LEAGUE_SCORING_RULES[LeagueScoringRuleType.WEIGHTED_TIEBREAK];
  }
  return LEAGUE_SCORING_RULES[LeagueScoringRuleType.SIMPLE];
}
