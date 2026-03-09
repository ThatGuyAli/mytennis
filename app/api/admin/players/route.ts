import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { toTitleCaseWords } from "@/lib/text";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

type CreatePlayerBody = {
  name?: string;
};

type DeletePlayerBody = {
  player_id?: string;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const leagueId = request.nextUrl.searchParams.get("league_id")?.trim() ?? "";
  if (leagueId) {
    const leaguePlayers = await query<{ id: string; name: string }>(
      `SELECT p.id, p.name
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       WHERE lp.league_id = $1
         AND lp.deleted_at IS NULL
         AND p.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [leagueId],
    );

    return NextResponse.json({
      data: {
        players: leaguePlayers.rows,
      },
    });
  }

  const pageParam = request.nextUrl.searchParams.get("page");
  const pageSizeParam = request.nextUrl.searchParams.get("page_size");
  const shouldPaginate = Boolean(pageParam || pageSizeParam);

  if (!shouldPaginate) {
    const playersResult = await query<{ id: string; name: string; created_at: string }>(
      `SELECT id, name, created_at::text
       FROM players
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC, name ASC`,
    );

    return NextResponse.json({
      data: {
        players: playersResult.rows,
      },
    });
  }

  const page = parsePositiveInt(pageParam, 1);
  const pageSize = parsePositiveInt(pageSizeParam, 10);
  const offset = (page - 1) * pageSize;

  const [playersResult, countResult] = await Promise.all([
    query<{ id: string; name: string; created_at: string }>(
      `SELECT id, name, created_at::text
       FROM players
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC, name ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM players
       WHERE deleted_at IS NULL`,
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? "0");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    data: {
      players: playersResult.rows,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: CreatePlayerBody | null = null;
  try {
    body = (await request.json()) as CreatePlayerBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const name = toTitleCaseWords(body?.name ?? "");
  if (!name) {
    return badRequestResponse("Player name is required.");
  }

  const existingPlayer = await query<{ id: string }>(
    `SELECT id
     FROM players
     WHERE deleted_at IS NULL
       AND LOWER(name) = LOWER($1)
     LIMIT 1`,
    [name],
  );

  if (existingPlayer.rows[0]) {
    return NextResponse.json({ error: "Player name already exists." }, { status: 409 });
  }

  try {
    await query(
      `INSERT INTO players (name, created_by)
       VALUES ($1, $2)`,
      [name, session.userId],
    );
  } catch (errorObject) {
    const dbCode =
      typeof errorObject === "object" && errorObject && "code" in errorObject
        ? String((errorObject as { code?: string }).code ?? "")
        : "";
    if (dbCode === "23505") {
      return NextResponse.json({ error: "Player name already exists." }, { status: 409 });
    }
    throw errorObject;
  }

  return NextResponse.json({ data: { created: true } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: DeletePlayerBody | null = null;
  try {
    body = (await request.json()) as DeletePlayerBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const playerId = body?.player_id?.trim() ?? "";
  if (!playerId) {
    return badRequestResponse("player_id is required.");
  }

  const deletedPlayer = await query<{ id: string }>(
    `UPDATE players
     SET deleted_at = now(),
         updated_at = now(),
         deleted_by = $2,
         updated_by = $2
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [playerId, session.userId],
  );

  if (!deletedPlayer.rows[0]) {
    return badRequestResponse("User not found or already deleted.");
  }

  await query(
    `UPDATE league_players
     SET deleted_at = now()
     WHERE player_id = $1
       AND deleted_at IS NULL`,
    [playerId],
  );

  return NextResponse.json({
    data: {
      deleted: true,
      message: "User deleted successfully.",
    },
  });
}
