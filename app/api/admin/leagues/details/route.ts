import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import type { League, MatchStatus } from "@/types";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../../utils";

type LeaguePlayerRow = {
  id: string;
  name: string;
};

type LeagueMatchRow = {
  id: string;
  week_number: number;
  status: MatchStatus;
  played_at: string | null;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
};

type MatchSetRow = {
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

  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim() ?? "";
  if (!leagueId) {
    return badRequestResponse("league_id is required.");
  }

  const leagueResult = await query<League>(
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
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [leagueId],
  );

  const league = leagueResult.rows[0];
  if (!league) {
    return badRequestResponse("League not found.");
  }

  const [playersResult, matchesResult, setsResult] = await Promise.all([
    query<LeaguePlayerRow>(
      `SELECT p.id, p.name
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       WHERE lp.league_id = $1
         AND lp.deleted_at IS NULL
         AND p.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [leagueId],
    ),
    query<LeagueMatchRow>(
      `SELECT
        m.id,
        m.week_number,
        m.status,
        m.played_at::text,
        m.player1_id,
        m.player2_id,
        p1.name AS player1_name,
        p2.name AS player2_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       WHERE m.league_id = $1
         AND m.deleted_at IS NULL
         AND p1.deleted_at IS NULL
         AND p2.deleted_at IS NULL
       ORDER BY m.week_number ASC, m.created_at ASC`,
      [leagueId],
    ),
    query<MatchSetRow>(
      `SELECT
        s.match_id,
        s.set_number,
        s.player1_games,
        s.player2_games,
        s.is_tiebreak
       FROM sets s
       JOIN matches m ON m.id = s.match_id
       WHERE m.league_id = $1
         AND m.deleted_at IS NULL
       ORDER BY s.match_id ASC, s.set_number ASC`,
      [leagueId],
    ),
  ]);

  return NextResponse.json({
    data: {
      league,
      players: playersResult.rows,
      matches: matchesResult.rows,
      sets: setsResult.rows,
    },
  });
}
