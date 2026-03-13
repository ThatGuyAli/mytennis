/* =========================
   Shared Types
========================= */

export type AuditFields = {
  created_at: string
  updated_at?: string | null
  deleted_at?: string | null

  created_by?: string | null
  updated_by?: string | null
  deleted_by?: string | null
}

export type ApiResponse<T> = {
  data?: T
  error?: string
}

/* =========================
   Users
========================= */

export type User = {
  id: string
  username: string
  password_hash: string
} & AuditFields

export type LoginInput = {
  username: string
  password: string
}

/* =========================
   Players
========================= */

export type Player = {
  id: string
  name: string
} & AuditFields

export type CreatePlayerInput = {
  name: string
}

export type UpdatePlayerInput = {
  name?: string
}

/* =========================
   Leagues
========================= */

export type LeagueRule =
  | "three_sets"
  | "two_sets_tiebreak"

export type League = {
  id: string
  name: string
  rule_type: LeagueRule
  scoring_rule_type: number
  active: number
  number_of_players: number
  first_round_weeks: number
} & AuditFields

export type CreateLeagueInput = {
  name: string
  rule_type: LeagueRule
  scoring_rule_type: number
  number_of_players: number
  first_round_weeks: number
}

export type UpdateLeagueInput = {
  name?: string
  rule_type?: LeagueRule
  scoring_rule_type?: number
  active?: number
  number_of_players?: number
  first_round_weeks?: number
}

/* =========================
   League Players
========================= */

export type LeaguePlayer = {
  id: string
  league_id: string
  player_id: string
  created_at: string
  deleted_at?: string | null
}

export type AddPlayerToLeagueInput = {
  league_id: string
  player_id: string
}

/* =========================
   Matches
========================= */

export type MatchStatus =
  | "scheduled"
  | "completed"
  | "dnf"
  | "dns"

export type Match = {
  id: string
  league_id: string
  player1_id: string
  player2_id: string
  week_number: number
  played_at?: string | null
  status: MatchStatus
} & AuditFields

export type CreateMatchInput = {
  league_id: string
  player1_id: string
  player2_id: string
  week_number: number
  played_at?: string
}

export type UpdateMatchInput = {
  player1_id?: string
  player2_id?: string
  week_number?: number
  played_at?: string
  status?: MatchStatus
}


/* =========================
   Sets (Match Results)
========================== */

export type Set = {
  id: string
  match_id: string
  set_number: number
  player1_games: number
  player2_games: number
  is_tiebreak: boolean
  created_at: string
}

export type CreateSetInput = {
  match_id: string
  set_number: number
  player1_games: number
  player2_games: number
  is_tiebreak?: boolean
}


/* =========================
   Combined Types (UI)
========================= */

export type MatchWithSets = {
  match: Match
  sets: Set[]
}

export type MatchDetails = {
  id: string
  league_id: string
  player1: Player
  player2: Player
  status: MatchStatus
  played_at?: string | null
  sets: Set[]
}

/* =========================
   Standings
========================= */

export type LeagueStanding = {
  position: number

  player_id: string
  player_name: string

  matches_played: number
  matches_won: number
  matches_lost: number

  sets_won: number
  sets_lost: number

  games_won: number
  games_lost: number

  points: number
}