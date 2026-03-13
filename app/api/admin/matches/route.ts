import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

type CreateMatchBody = {
  league_id?: string;
  player1_id?: string;
  player2_id?: string;
  week_number?: number;
  played_at?: string;
  matches?: Array<{
    player1_id?: string;
    player2_id?: string;
  }>;
  weeks?: Array<{
    week_number?: number;
    played_at?: string;
    matches?: Array<{
      player1_id?: string;
      player2_id?: string;
    }>;
  }>;
};

type UpdateWeekMatchesBody = {
  league_id?: string;
  week_number?: number;
  played_at?: string;
  match_id?: string;
  status?: "dns";
  matches?: Array<{
    player1_id?: string;
    player2_id?: string;
  }>;
};

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: CreateMatchBody | null = null;
  try {
    body = (await request.json()) as CreateMatchBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const leagueId = body?.league_id?.trim() ?? "";
  const player1Id = body?.player1_id?.trim() ?? "";
  const player2Id = body?.player2_id?.trim() ?? "";
  const weekNumber = Number(body?.week_number);
  const playedAt = body?.played_at?.trim() ?? "";
  const matchesInput = body?.matches;
  const weeksInput = body?.weeks;

  if (!leagueId) {
    return badRequestResponse("League is required.");
  }

  const activeLeaguePlayers = await query<{ player_id: string }>(
    `SELECT player_id
     FROM league_players
     WHERE league_id = $1
       AND deleted_at IS NULL`,
    [leagueId],
  );
  const activeIds = new Set(activeLeaguePlayers.rows.map((row) => row.player_id));

  if (Array.isArray(weeksInput) && weeksInput.length > 0) {
    const normalizedWeeks = weeksInput.map((week) => ({
      week_number: Number(week.week_number),
      played_at: week.played_at?.trim() ?? "",
      matches: (week.matches ?? []).map((item) => ({
        player1_id: item.player1_id?.trim() ?? "",
        player2_id: item.player2_id?.trim() ?? "",
      })),
    }));

    for (const week of normalizedWeeks) {
      if (!Number.isInteger(week.week_number) || week.week_number < 1) {
        return badRequestResponse("Each week must have a valid week_number >= 1.");
      }
      if (!Array.isArray(week.matches) || week.matches.length === 0) {
        return badRequestResponse("Each week must have at least one match.");
      }
    }

    const weekNumbers = normalizedWeeks.map((item) => item.week_number);
    const uniqueWeeks = new Set(weekNumbers);
    if (uniqueWeeks.size !== weekNumbers.length) {
      return badRequestResponse("Duplicate week entries are not allowed.");
    }

    const existingMatches = await query<{
      week_number: number;
      player1_id: string;
      player2_id: string;
    }>(
      `SELECT week_number, player1_id, player2_id
       FROM matches
       WHERE league_id = $1
         AND week_number = ANY($2::int[])
         AND deleted_at IS NULL`,
      [leagueId, weekNumbers],
    );

    const alreadyScheduledByWeek = new Map<number, Set<string>>();
    for (const row of existingMatches.rows) {
      const current = alreadyScheduledByWeek.get(row.week_number) ?? new Set<string>();
      current.add(row.player1_id);
      current.add(row.player2_id);
      alreadyScheduledByWeek.set(row.week_number, current);
    }

    for (const week of normalizedWeeks) {
      const weekUsedPlayers = new Set<string>();
      const alreadyScheduled = alreadyScheduledByWeek.get(week.week_number) ?? new Set<string>();

      for (const match of week.matches) {
        if (!match.player1_id || !match.player2_id) {
          return badRequestResponse("Each match requires Player 1 and Player 2.");
        }
        if (match.player1_id === match.player2_id) {
          return badRequestResponse("A player cannot play against themselves.");
        }
        if (!activeIds.has(match.player1_id) || !activeIds.has(match.player2_id)) {
          return badRequestResponse(
            "Both selected players must belong to the chosen league.",
          );
        }
        if (
          weekUsedPlayers.has(match.player1_id) ||
          weekUsedPlayers.has(match.player2_id)
        ) {
          return badRequestResponse("A player can only be scheduled once per week.");
        }
        if (
          alreadyScheduled.has(match.player1_id) ||
          alreadyScheduled.has(match.player2_id)
        ) {
          return badRequestResponse(
            `One or more players already have a match scheduled for week ${week.week_number}.`,
          );
        }
        weekUsedPlayers.add(match.player1_id);
        weekUsedPlayers.add(match.player2_id);
      }
    }

    for (const week of normalizedWeeks) {
      for (const match of week.matches) {
        await query(
          `INSERT INTO matches (
            league_id,
            week_number,
            player1_id,
            player2_id,
            played_at,
            status,
            created_by
          )
          VALUES ($1, $2, $3, $4, NULLIF($5, '')::date, 'scheduled', $6)`,
          [
            leagueId,
            week.week_number,
            match.player1_id,
            match.player2_id,
            week.played_at,
            session.userId,
          ],
        );
      }
    }

    const insertedCount = normalizedWeeks.reduce(
      (sum, week) => sum + week.matches.length,
      0,
    );

    return NextResponse.json(
      {
        data: {
          created: true,
          count: insertedCount,
          message: `${insertedCount} matches saved across ${normalizedWeeks.length} weeks.`,
        },
      },
      { status: 201 },
    );
  }

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return badRequestResponse("week_number must be an integer >= 1.");
  }

  const existingWeekMatches = await query<{ player1_id: string; player2_id: string }>(
    `SELECT player1_id, player2_id
     FROM matches
     WHERE league_id = $1
       AND week_number = $2
       AND deleted_at IS NULL`,
    [leagueId, weekNumber],
  );
  const alreadyScheduled = new Set<string>();
  for (const match of existingWeekMatches.rows) {
    alreadyScheduled.add(match.player1_id);
    alreadyScheduled.add(match.player2_id);
  }

  const isBulk = Array.isArray(matchesInput);
  const normalizedMatches = isBulk
    ? matchesInput.map((item) => ({
        player1_id: item.player1_id?.trim() ?? "",
        player2_id: item.player2_id?.trim() ?? "",
      }))
    : [{ player1_id: player1Id, player2_id: player2Id }];

  if (normalizedMatches.length === 0) {
    return badRequestResponse("At least one match is required.");
  }

  const payloadUsedPlayers = new Set<string>();

  for (const item of normalizedMatches) {
    if (!item.player1_id || !item.player2_id) {
      return badRequestResponse("Each match requires Player 1 and Player 2.");
    }
    if (item.player1_id === item.player2_id) {
      return badRequestResponse("A player cannot play against themselves.");
    }
    if (!activeIds.has(item.player1_id) || !activeIds.has(item.player2_id)) {
      return badRequestResponse(
        "Both selected players must belong to the chosen league.",
      );
    }
    if (payloadUsedPlayers.has(item.player1_id) || payloadUsedPlayers.has(item.player2_id)) {
      return badRequestResponse("A player can only be scheduled once per week.");
    }
    if (alreadyScheduled.has(item.player1_id) || alreadyScheduled.has(item.player2_id)) {
      return badRequestResponse(
        "One or more players already have a match scheduled for this week.",
      );
    }
    payloadUsedPlayers.add(item.player1_id);
    payloadUsedPlayers.add(item.player2_id);
  }

  for (const item of normalizedMatches) {
    await query(
      `INSERT INTO matches (
        league_id,
        week_number,
        player1_id,
        player2_id,
        played_at,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, NULLIF($5, '')::date, 'scheduled', $6)`,
      [
        leagueId,
        weekNumber,
        item.player1_id,
        item.player2_id,
        playedAt,
        session.userId,
      ],
    );
  }

  return NextResponse.json(
    {
      data: {
        created: true,
        count: normalizedMatches.length,
        message: isBulk
          ? `${normalizedMatches.length} matches saved for week ${weekNumber}.`
          : "Match created successfully.",
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: UpdateWeekMatchesBody | null = null;
  try {
    body = (await request.json()) as UpdateWeekMatchesBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const leagueId = body?.league_id?.trim() ?? "";
  const matchId = body?.match_id?.trim() ?? "";
  const weekNumber = Number(body?.week_number);
  const playedAt = body?.played_at?.trim() ?? "";
  const statusUpdate = body?.status;
  const matchesInput = body?.matches ?? [];

  if (matchId) {
    const existingSets = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM sets
       WHERE match_id = $1`,
      [matchId],
    );
    const setsCount = Number(existingSets.rows[0]?.count ?? "0");

    if (statusUpdate === "dns") {
      if (setsCount > 0) {
        return badRequestResponse(
          "Cannot set DNS for a match that has results. Remove results first.",
        );
      }
      const updatedMatch = await query<{ id: string }>(
        `UPDATE matches
         SET status = 'dns',
             updated_at = now(),
             updated_by = $2
         WHERE id = $1
           AND deleted_at IS NULL
         RETURNING id`,
        [matchId, session.userId],
      );
      if (updatedMatch.rowCount === 0) {
        return NextResponse.json({ error: "Match not found." }, { status: 404 });
      }
      return NextResponse.json({
        data: {
          updated: true,
          message: "Match marked as DNS (Did Not Show Up).",
        },
      });
    }

    if (setsCount > 0) {
      return badRequestResponse(
        "This match already has results. Match date cannot be edited.",
      );
    }

    const updatedMatch = await query<{ id: string }>(
      `UPDATE matches
       SET played_at = NULLIF($2, '')::date,
           updated_at = now(),
           updated_by = $3
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [matchId, playedAt, session.userId],
    );

    if (updatedMatch.rowCount === 0) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        updated: true,
        message: "Match date updated successfully.",
      },
    });
  }

  if (!leagueId) {
    return badRequestResponse("league_id is required.");
  }
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return badRequestResponse("week_number must be an integer >= 1.");
  }
  if (!Array.isArray(matchesInput) || matchesInput.length === 0) {
    return badRequestResponse("At least one match is required.");
  }

  const activeLeaguePlayers = await query<{ player_id: string }>(
    `SELECT player_id
     FROM league_players
     WHERE league_id = $1
       AND deleted_at IS NULL`,
    [leagueId],
  );
  const activeIds = new Set(activeLeaguePlayers.rows.map((row) => row.player_id));

  const normalizedMatches = matchesInput.map((item) => ({
    player1_id: item.player1_id?.trim() ?? "",
    player2_id: item.player2_id?.trim() ?? "",
  }));

  const payloadUsedPlayers = new Set<string>();
  for (const item of normalizedMatches) {
    if (!item.player1_id || !item.player2_id) {
      return badRequestResponse("Each match requires Player 1 and Player 2.");
    }
    if (item.player1_id === item.player2_id) {
      return badRequestResponse("A player cannot play against themselves.");
    }
    if (!activeIds.has(item.player1_id) || !activeIds.has(item.player2_id)) {
      return badRequestResponse("Both selected players must belong to the chosen league.");
    }
    if (payloadUsedPlayers.has(item.player1_id) || payloadUsedPlayers.has(item.player2_id)) {
      return badRequestResponse("A player can only be scheduled once per week.");
    }
    payloadUsedPlayers.add(item.player1_id);
    payloadUsedPlayers.add(item.player2_id);
  }

  const existingWeekMatchIds = await query<{ id: string }>(
    `SELECT id
     FROM matches
     WHERE league_id = $1
       AND week_number = $2
       AND deleted_at IS NULL`,
    [leagueId, weekNumber],
  );

  if (existingWeekMatchIds.rowCount === 0) {
    return NextResponse.json(
      { error: `No existing matches found for week ${weekNumber}.` },
      { status: 404 },
    );
  }

  const existingIds = existingWeekMatchIds.rows.map((row) => row.id);
  const existingWeekSets = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM sets
     WHERE match_id = ANY($1::uuid[])`,
    [existingIds],
  );
  const existingSetsCount = Number(existingWeekSets.rows[0]?.count ?? "0");
  if (existingSetsCount > 0) {
    return badRequestResponse(
      `Week ${weekNumber} already has set results. Remove results before editing matches.`,
    );
  }

  await query(
    `UPDATE matches
     SET deleted_at = now(),
         deleted_by = $3
     WHERE league_id = $1
       AND week_number = $2
       AND deleted_at IS NULL`,
    [leagueId, weekNumber, session.userId],
  );

  for (const item of normalizedMatches) {
    await query(
      `INSERT INTO matches (
        league_id,
        week_number,
        player1_id,
        player2_id,
        played_at,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, NULLIF($5, '')::date, 'scheduled', $6)`,
      [leagueId, weekNumber, item.player1_id, item.player2_id, playedAt, session.userId],
    );
  }

  return NextResponse.json({
    data: {
      updated: true,
      count: normalizedMatches.length,
      message: `Week ${weekNumber} matches updated successfully.`,
    },
  });
}
