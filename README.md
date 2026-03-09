# Tennis League Management System

## Technical Design Report

### 1. Overview

This document describes the architecture and data structures for the **Tennis League Management Application** built with:

* **Frontend / Backend:** Next.js (App Router)
* **Database:** Neon PostgreSQL (Free Tier)
* **Language:** TypeScript

The system allows **administrators** to:

* Create and manage **players**
* Create and manage **leagues**
* Assign **players to leagues**
* Schedule **matches between players**
* Edit match details
* Enter **match results (sets)**

The design intentionally remains **simple and maintainable** to support a small application without unnecessary complexity.

---

# 2. Core Entities

The application uses six core database tables.

| Table          | Purpose                           |
| -------------- | --------------------------------- |
| users          | Admin users who manage the system |
| players        | Tennis players                    |
| leagues        | Tennis leagues                    |
| league_players | Assignment of players to leagues  |
| matches        | Scheduled matches between players |
| sets           | Match results                     |

---

# 3. Database Schema

### Enable UUID generation

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

# 3.1 Users Table

Admin users authenticate with **username and password**.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz
);
```

---

# 3.2 Players Table

Stores all tennis players.

```sql
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
```

Features:

* Supports **soft deletion**
* Tracks which admin created or modified records

---

# 3.3 Leagues Table

Represents a tennis league.

```sql
CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active int NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  number_of_players int NOT NULL CHECK (number_of_players > 0),
  first_round_weeks int NOT NULL CHECK (first_round_weeks > 0),

  rule_type text NOT NULL CHECK (
    rule_type IN ('three_sets', 'two_sets_tiebreak')
  ),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_by uuid REFERENCES users(id)
);
```

League rule types:

| Rule              | Description                           |
| ----------------- | ------------------------------------- |
| three_sets        | Match consists of up to 3 full sets   |
| two_sets_tiebreak | Two sets plus a tie-break set if tied |

League active flag:

| active | Meaning         |
| ------ | --------------- |
| 1      | League is active |
| 0      | League is finished/inactive |

---

# 3.4 League Players Table

Associates players with leagues.

```sql
CREATE TABLE league_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  league_id uuid NOT NULL REFERENCES leagues(id),
  player_id uuid NOT NULL REFERENCES players(id),

  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  UNIQUE (league_id, player_id)
);
```

This table ensures:

* A player cannot be added to the same league twice.

---

# 3.5 Matches Table

Stores matches between players.

```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  league_id uuid NOT NULL REFERENCES leagues(id),
  week_number int NOT NULL CHECK (week_number > 0),

  player1_id uuid NOT NULL REFERENCES players(id),
  player2_id uuid NOT NULL REFERENCES players(id),

  played_at date,

  status text DEFAULT 'scheduled'
  CHECK (status IN ('scheduled','completed')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  deleted_by uuid REFERENCES users(id),

  CHECK (player1_id <> player2_id)
);
```

Match status values:

| Status    | Description                        |
| --------- | ---------------------------------- |
| scheduled | Match is planned but not completed |
| completed | Match results have been entered    |

---

# 3.6 Sets Table

Stores results for each match set.

```sql
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
```

Example result:

| Set | Player1 | Player2 |
| --- | ------- | ------- |
| 1   | 6       | 4       |
| 2   | 4       | 6       |
| 3   | 10      | 7       |

---

# 4. Recommended Indexes

```sql
CREATE INDEX idx_players_deleted
ON players(deleted_at);

CREATE INDEX idx_leagues_deleted
ON leagues(deleted_at);

CREATE INDEX idx_matches_league
ON matches(league_id);

CREATE INDEX idx_sets_match
ON sets(match_id);
```

These indexes improve performance when retrieving matches and active records.

---

# 5. Next.js Application Types

All TypeScript types are stored in a single file:

```
/types/index.ts
```

---

## Shared Types

```ts
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
```

---

## Users

```ts
export type User = {
  id: string
  username: string
  password_hash: string
} & AuditFields

export type LoginInput = {
  username: string
  password: string
}
```

---

## Players

```ts
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
```

---

## Leagues

```ts
export type LeagueRule =
  | "three_sets"
  | "two_sets_tiebreak"

export type League = {
  id: string
  name: string
  rule_type: LeagueRule
  active: number
  number_of_players: number
  first_round_weeks: number
} & AuditFields

export type CreateLeagueInput = {
  name: string
  rule_type: LeagueRule
  number_of_players: number
  first_round_weeks: number
}

export type UpdateLeagueInput = {
  name?: string
  rule_type?: LeagueRule
  active?: number
  number_of_players?: number
  first_round_weeks?: number
}
```

---

## League Players

```ts
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
```

---

## Matches

```ts
export type MatchStatus =
  | "scheduled"
  | "completed"

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
```

---

## Sets

```ts
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
```

---

## Combined Types

```ts
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
```

---

# 6. Project Folder Structure

Recommended Next.js structure:

```
/app
/api

/lib
  db.ts
  auth.ts

/types
  index.ts
```

---

# 7. Summary

This architecture provides a **simple and scalable solution** for managing tennis leagues.

Key features include:

* Admin authentication
* Player management
* League management
* Player-league assignment
* Match scheduling
* Match result entry
* Soft deletion support
* Audit tracking

The design keeps the system **lightweight**, ideal for **Next.js + Neon PostgreSQL free tier**, while remaining flexible for future expansion.

---
