export enum LeagueScoringRuleType {
  STANDARD_THREE_SETS = 1,
  STANDARD_THREE_SETS_THIRD_SET_TIEBREAK = 2,
}

export type WinnerPointsContext = {
  hasTieBreakSet: boolean;
  /** For STANDARD_THREE_SETS: 0 = 2-0 win, 1 = 2-1 win */
  setsWonByLoser?: number;
};

export type LoserPointsContext = {
  hasTieBreakSet: boolean;
  totalGamesWon: number;
  /** For STANDARD_THREE_SETS: 0 = 2-0 loss, 1 = 2-1 loss */
  setsWonByLoser?: number;
};

export type LeagueScoringRule = {
  type: LeagueScoringRuleType;
  label: string;
  getWinnerPoints: (context: WinnerPointsContext) => number;
  getLoserPoints: (context: LoserPointsContext) => number;
  getDrawPoints: () => number;
};

export const LEAGUE_SCORING_RULES: Record<LeagueScoringRuleType, LeagueScoringRule> = {
  [LeagueScoringRuleType.STANDARD_THREE_SETS]: {
    type: LeagueScoringRuleType.STANDARD_THREE_SETS,
    label: "Standard Three Sets",
    getWinnerPoints: (context) => (context.setsWonByLoser === 1 ? 2 : 3),
    getLoserPoints: (context) => (context.setsWonByLoser === 1 ? 1 : 0),
    getDrawPoints: () => 1.5,
  },
  [LeagueScoringRuleType.STANDARD_THREE_SETS_THIRD_SET_TIEBREAK]: {
    type: LeagueScoringRuleType.STANDARD_THREE_SETS_THIRD_SET_TIEBREAK,
    label: "Standard Three Sets (Third Set Tie-break)",
    getWinnerPoints: (context) => (context.setsWonByLoser === 1 ? 2 : 3),
    getLoserPoints: (context) => (context.setsWonByLoser === 1 ? 1 : 0),
    getDrawPoints: () => 1.5,
  },
};

export function getLeagueScoringRule(ruleType: LeagueScoringRuleType) {
  return LEAGUE_SCORING_RULES[ruleType];
}

export function getLeagueScoringRuleByNumber(ruleType: number) {
  if (ruleType === LeagueScoringRuleType.STANDARD_THREE_SETS) {
    return LEAGUE_SCORING_RULES[LeagueScoringRuleType.STANDARD_THREE_SETS];
  }
  if (ruleType === LeagueScoringRuleType.STANDARD_THREE_SETS_THIRD_SET_TIEBREAK) {
    return LEAGUE_SCORING_RULES[LeagueScoringRuleType.STANDARD_THREE_SETS_THIRD_SET_TIEBREAK];
  }
  return LEAGUE_SCORING_RULES[LeagueScoringRuleType.STANDARD_THREE_SETS];
}
