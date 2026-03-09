import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

type AttachPlayerBody = {
  league_id?: string;
  player_id?: string;
};

type RemovePlayerBody = {
  league_id?: string;
  player_id?: string;
};

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: AttachPlayerBody | null = null;
  try {
    body = (await request.json()) as AttachPlayerBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const leagueId = body?.league_id?.trim() ?? "";
  const playerId = body?.player_id?.trim() ?? "";

  if (!leagueId || !playerId) {
    return badRequestResponse("Both league and player are required.");
  }

  const existing = await query<{ id: string; deleted_at: string | null }>(
    `SELECT id, deleted_at::text
     FROM league_players
     WHERE league_id = $1
       AND player_id = $2
     LIMIT 1`,
    [leagueId, playerId],
  );

  const current = existing.rows[0];
  if (current && current.deleted_at === null) {
    return NextResponse.json(
      { error: "Player is already attached to this league." },
      { status: 409 },
    );
  }

  await query(
    `INSERT INTO league_players (league_id, player_id)
     VALUES ($1, $2)
     ON CONFLICT (league_id, player_id)
     DO UPDATE SET deleted_at = NULL`,
    [leagueId, playerId],
  );

  return NextResponse.json(
    {
      data: {
        attached: true,
        message: "Player attached to league successfully.",
      },
    },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: RemovePlayerBody | null = null;
  try {
    body = (await request.json()) as RemovePlayerBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const leagueId = body?.league_id?.trim() ?? "";
  const playerId = body?.player_id?.trim() ?? "";

  if (!leagueId || !playerId) {
    return badRequestResponse("Both league_id and player_id are required.");
  }

  const result = await query<{ id: string }>(
    `UPDATE league_players
     SET deleted_at = now()
     WHERE league_id = $1
       AND player_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [leagueId, playerId],
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: "Player is not currently attached to this league." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      removed: true,
      message: "Player removed from league successfully.",
    },
  });
}
