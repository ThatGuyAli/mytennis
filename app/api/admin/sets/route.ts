import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

type CreateSetBody = {
  match_id?: string;
  set_number?: number;
  player1_games?: number;
  player2_games?: number;
  is_tiebreak?: boolean;
};

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: CreateSetBody | null = null;
  try {
    body = (await request.json()) as CreateSetBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const matchId = body?.match_id?.trim() ?? "";
  const setNumber = Number(body?.set_number);
  const player1Games = Number(body?.player1_games);
  const player2Games = Number(body?.player2_games);
  const isTiebreak = Boolean(body?.is_tiebreak);

  if (!matchId) {
    return badRequestResponse("A match must be selected.");
  }

  if (!Number.isInteger(setNumber) || setNumber < 1) {
    return badRequestResponse("Set number must be a positive integer.");
  }

  if (!Number.isInteger(player1Games) || !Number.isInteger(player2Games)) {
    return badRequestResponse("Game counts must be integers.");
  }

  if (player1Games < 0 || player2Games < 0) {
    return badRequestResponse("Game counts cannot be negative.");
  }

  const matchExists = await query<{ id: string }>(
    `SELECT id
     FROM matches
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [matchId],
  );

  if (!matchExists.rows[0]) {
    return badRequestResponse("Selected match does not exist.");
  }

  await query(
    `INSERT INTO sets (
      match_id,
      set_number,
      player1_games,
      player2_games,
      is_tiebreak
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (match_id, set_number)
    DO UPDATE SET
      player1_games = EXCLUDED.player1_games,
      player2_games = EXCLUDED.player2_games,
      is_tiebreak = EXCLUDED.is_tiebreak`,
    [matchId, setNumber, player1Games, player2Games, isTiebreak],
  );

  await query(
    `UPDATE matches
     SET status = 'completed',
         updated_at = now(),
         updated_by = $2
     WHERE id = $1`,
    [matchId, session.userId],
  );

  return NextResponse.json({ data: { upserted: true } }, { status: 201 });
}
