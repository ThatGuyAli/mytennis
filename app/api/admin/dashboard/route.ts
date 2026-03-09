import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import type { League, MatchStatus, Player } from "@/types";

import { getApiSession, unauthorizedResponse } from "../utils";

type LeagueAssignment = {
  id: string;
  league_id: string;
  player_id: string;
  league_name: string;
  player_name: string;
};

type MatchRow = {
  id: string;
  league_id: string;
  league_name: string;
  player1_name: string;
  player2_name: string;
  week_number: number;
  played_at: string | null;
  status: MatchStatus;
};

type SetRow = {
  match_id: string;
  set_number: number;
  player1_games: number;
  player2_games: number;
  is_tiebreak: boolean;
};

export async function GET(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const [leaguesResult, playersResult, assignmentsResult, matchesResult, setsResult] =
    await Promise.all([
      query<League>(
        `SELECT
          id,
          name,
          rule_type,
          active,
          number_of_players,
          first_round_weeks,
          created_at,
          updated_at,
          deleted_at,
          created_by,
          updated_by,
          deleted_by
         FROM leagues
         WHERE deleted_at IS NULL
           AND active = 1
         ORDER BY name ASC`,
      ),
      query<Player>(
        `SELECT id, name, created_at, updated_at, deleted_at, created_by, updated_by, deleted_by
         FROM players
         WHERE deleted_at IS NULL
         ORDER BY name ASC`,
      ),
      query<LeagueAssignment>(
        `SELECT
          lp.id,
          lp.league_id,
          lp.player_id,
          l.name AS league_name,
          p.name AS player_name
         FROM league_players lp
         JOIN leagues l ON l.id = lp.league_id
         JOIN players p ON p.id = lp.player_id
         WHERE lp.deleted_at IS NULL
           AND l.deleted_at IS NULL
           AND l.active = 1
           AND p.deleted_at IS NULL
         ORDER BY l.name ASC, p.name ASC`,
      ),
      query<MatchRow>(
        `SELECT
          m.id,
          m.league_id,
          l.name AS league_name,
          p1.name AS player1_name,
          p2.name AS player2_name,
          m.week_number,
          m.played_at::text,
          m.status
         FROM matches m
         JOIN leagues l ON l.id = m.league_id
         JOIN players p1 ON p1.id = m.player1_id
         JOIN players p2 ON p2.id = m.player2_id
         WHERE m.deleted_at IS NULL
           AND l.deleted_at IS NULL
           AND l.active = 1
           AND p1.deleted_at IS NULL
           AND p2.deleted_at IS NULL
         ORDER BY m.created_at DESC`,
      ),
      query<SetRow>(
        `SELECT match_id, set_number, player1_games, player2_games, is_tiebreak
         FROM sets
         ORDER BY match_id, set_number ASC`,
      ),
    ]);

  return NextResponse.json({
    data: {
      user: {
        id: session.userId,
        username: session.username,
      },
      leagues: leaguesResult.rows,
      players: playersResult.rows,
      assignments: assignmentsResult.rows,
      matches: matchesResult.rows,
      sets: setsResult.rows,
    },
  });
}
