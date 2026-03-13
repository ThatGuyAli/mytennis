/* =====================================================
   TENNIS LEAGUE MANAGEMENT DATABASE SCHEMA
   Compatible with Neon PostgreSQL
===================================================== */

/* -----------------------------------------------------
   Enable UUID generation
----------------------------------------------------- */

CREATE EXTENSION IF NOT EXISTS pgcrypto;


/* =====================================================
   USERS (Admins)
===================================================== */

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz
);


/* =====================================================
   PLAYERS
===================================================== */

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_by uuid REFERENCES users(id)
);


/* =====================================================
   LEAGUES
===================================================== */

CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active int NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  scoring_rule_type int NOT NULL DEFAULT 1 CHECK (scoring_rule_type IN (1, 2, 3, 4, 5)),
  number_of_players int NOT NULL CHECK (number_of_players > 0),
  first_round_weeks int NOT NULL CHECK (first_round_weeks > 0),

  rule_type text NOT NULL
  CHECK (rule_type IN ('three_sets','two_sets_tiebreak')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_by uuid REFERENCES users(id)
);


/* =====================================================
   LEAGUE PLAYERS
===================================================== */

CREATE TABLE league_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  league_id uuid NOT NULL REFERENCES leagues(id),
  player_id uuid NOT NULL REFERENCES players(id),

  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  UNIQUE (league_id, player_id)
);


/* =====================================================
   MATCHES
===================================================== */

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  league_id uuid NOT NULL REFERENCES leagues(id),
  week_number int NOT NULL CHECK (week_number > 0),

  player1_id uuid NOT NULL REFERENCES players(id),
  player2_id uuid NOT NULL REFERENCES players(id),

  played_at date,

  status text DEFAULT 'scheduled'
  CHECK (status IN ('scheduled','completed','dnf','dns')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_by uuid REFERENCES users(id),

  CHECK (player1_id <> player2_id)
);

-- Match status values:
--   scheduled  Match is planned but not yet played
--   completed  Match finished with full result
--   dnf        Did Not Finish - match abandoned mid-play (partial sets may exist)
--   dns        Did Not Show Up - player(s) did not attend


/* =====================================================
   SETS (Match Results)
===================================================== */

CREATE TABLE sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

  set_number int NOT NULL,

  player1_games int NOT NULL,
  player2_games int NOT NULL,

  is_tiebreak boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),

  UNIQUE (match_id, set_number)
);


/* =====================================================
   INDEXES (Performance)
===================================================== */

CREATE INDEX idx_players_deleted
ON players(deleted_at);

CREATE UNIQUE INDEX uq_players_active_name_ci
ON players (LOWER(name))
WHERE deleted_at IS NULL;

CREATE INDEX idx_leagues_deleted
ON leagues(deleted_at);

CREATE INDEX idx_matches_league
ON matches(league_id);

CREATE INDEX idx_matches_week
ON matches(week_number);

CREATE INDEX idx_sets_match
ON sets(match_id);

CREATE INDEX idx_league_players_league
ON league_players(league_id);

CREATE INDEX idx_league_players_player
ON league_players(player_id);