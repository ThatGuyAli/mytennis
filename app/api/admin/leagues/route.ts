import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { toTitleCaseWords } from "@/lib/text";
import type { LeagueRule } from "@/types";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

const VALID_RULE_TYPES: LeagueRule[] = ["three_sets", "two_sets_tiebreak"];
const VALID_SCORING_RULE_TYPES = [1, 2, 3, 4, 5] as const;

type CreateLeagueBody = {
  name?: string;
  rule_type?: LeagueRule;
  scoring_rule_type?: number;
  number_of_players?: number;
  first_round_weeks?: number;
};

type UpdateLeagueBody = {
  league_id?: string;
  name?: string;
  rule_type?: LeagueRule;
  scoring_rule_type?: number;
  active?: number | boolean;
  number_of_players?: number;
  first_round_weeks?: number;
};

export async function GET(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const leagues = await query<{
    id: string;
    name: string;
    rule_type: LeagueRule;
    scoring_rule_type: number;
    active: number;
    number_of_players: number;
    first_round_weeks: number;
  }>(
    `SELECT id, name, rule_type, scoring_rule_type, active, number_of_players, first_round_weeks
     FROM leagues
     WHERE deleted_at IS NULL
       AND active = 1
     ORDER BY name ASC`,
  );

  return NextResponse.json({
    data: {
      leagues: leagues.rows,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: CreateLeagueBody | null = null;
  try {
    body = (await request.json()) as CreateLeagueBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const name = toTitleCaseWords(body?.name ?? "");
  const ruleType = body?.rule_type;
  const scoringRuleType = Number(body?.scoring_rule_type ?? 1);
  const numberOfPlayers = Number(body?.number_of_players);
  const firstRoundWeeks = Number(body?.first_round_weeks);

  if (!name) {
    return badRequestResponse("League name is required.");
  }

  if (!ruleType || !VALID_RULE_TYPES.includes(ruleType)) {
    return badRequestResponse("Invalid league rule type.");
  }
  if (!VALID_SCORING_RULE_TYPES.includes(scoringRuleType as (typeof VALID_SCORING_RULE_TYPES)[number])) {
    return badRequestResponse("Invalid scoring_rule_type. Allowed values are 1, 2, 3, 4, 5.");
  }

  if (!Number.isInteger(numberOfPlayers) || numberOfPlayers < 2) {
    return badRequestResponse("number_of_players must be an integer >= 2.");
  }

  if (!Number.isInteger(firstRoundWeeks) || firstRoundWeeks < 1) {
    return badRequestResponse("first_round_weeks must be an integer >= 1.");
  }

  const createdLeague = await query<{ id: string; name: string }>(
    `INSERT INTO leagues (
      name,
      rule_type,
      scoring_rule_type,
      active,
      number_of_players,
      first_round_weeks,
      created_by
    )
     VALUES ($1, $2, $3, 1, $4, $5, $6)
     RETURNING id, name`,
    [name, ruleType, scoringRuleType, numberOfPlayers, firstRoundWeeks, session.userId],
  );

  return NextResponse.json(
    {
      data: {
        created: true,
        league: createdLeague.rows[0],
        message: "League created successfully.",
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

  let body: UpdateLeagueBody | null = null;
  try {
    body = (await request.json()) as UpdateLeagueBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const leagueId = body?.league_id?.trim() ?? "";
  if (!leagueId) {
    return badRequestResponse("league_id is required.");
  }

  const hasName = typeof body?.name === "string";
  const hasRuleType = typeof body?.rule_type === "string";
  const hasScoringRuleType = typeof body?.scoring_rule_type !== "undefined";
  const hasActive = typeof body?.active !== "undefined";
  const hasNumberOfPlayers = typeof body?.number_of_players !== "undefined";
  const hasFirstRoundWeeks = typeof body?.first_round_weeks !== "undefined";

  if (
    !hasName &&
    !hasRuleType &&
    !hasScoringRuleType &&
    !hasActive &&
    !hasNumberOfPlayers &&
    !hasFirstRoundWeeks
  ) {
    return badRequestResponse("At least one field is required to update.");
  }

  const normalizedName = hasName ? toTitleCaseWords(body?.name ?? "") : null;
  if (hasName && !normalizedName) {
    return badRequestResponse("League name cannot be empty.");
  }

  const ruleType = hasRuleType ? body?.rule_type : null;
  if (hasRuleType && (!ruleType || !VALID_RULE_TYPES.includes(ruleType))) {
    return badRequestResponse("Invalid league rule type.");
  }
  const scoringRuleType = hasScoringRuleType ? Number(body?.scoring_rule_type) : null;
  if (
    hasScoringRuleType &&
    !VALID_SCORING_RULE_TYPES.includes(
      scoringRuleType as (typeof VALID_SCORING_RULE_TYPES)[number],
    )
  ) {
    return badRequestResponse("Invalid scoring_rule_type. Allowed values are 1, 2, 3, 4, 5.");
  }

  const normalizedActive = hasActive ? Number(body?.active) : null;
  if (hasActive && normalizedActive !== 0 && normalizedActive !== 1) {
    return badRequestResponse("active must be 0 or 1.");
  }

  const numberOfPlayers = hasNumberOfPlayers ? Number(body?.number_of_players) : null;
  if (
    hasNumberOfPlayers &&
    (!Number.isInteger(numberOfPlayers) || (numberOfPlayers as number) < 2)
  ) {
    return badRequestResponse("number_of_players must be an integer >= 2.");
  }

  const firstRoundWeeks = hasFirstRoundWeeks ? Number(body?.first_round_weeks) : null;
  if (
    hasFirstRoundWeeks &&
    (!Number.isInteger(firstRoundWeeks) || (firstRoundWeeks as number) < 1)
  ) {
    return badRequestResponse("first_round_weeks must be an integer >= 1.");
  }

  if (hasNumberOfPlayers) {
    const assignedPlayers = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM league_players
       WHERE league_id = $1
         AND deleted_at IS NULL`,
      [leagueId],
    );
    const activeAssignedCount = Number(assignedPlayers.rows[0]?.count ?? "0");
    if ((numberOfPlayers as number) < activeAssignedCount) {
      return badRequestResponse(
        `number_of_players cannot be lower than currently assigned players (${activeAssignedCount}).`,
      );
    }
  }

  if (hasFirstRoundWeeks) {
    const maxWeek = await query<{ max_week: number | null }>(
      `SELECT MAX(week_number)::int AS max_week
       FROM matches
       WHERE league_id = $1
         AND deleted_at IS NULL`,
      [leagueId],
    );
    const currentMaxWeek = maxWeek.rows[0]?.max_week ?? 0;
    if ((firstRoundWeeks as number) < currentMaxWeek) {
      return badRequestResponse(
        `first_round_weeks cannot be lower than existing saved week ${currentMaxWeek}.`,
      );
    }
  }

  const updated = await query<{
    id: string;
    name: string;
    rule_type: LeagueRule;
    scoring_rule_type: number;
    active: number;
    number_of_players: number;
    first_round_weeks: number;
  }>(
    `UPDATE leagues
     SET
       name = COALESCE($2, name),
       rule_type = COALESCE($3, rule_type),
       scoring_rule_type = COALESCE($4, scoring_rule_type),
       active = COALESCE($5, active),
       number_of_players = COALESCE($6, number_of_players),
       first_round_weeks = COALESCE($7, first_round_weeks),
       updated_at = now(),
       updated_by = $8
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, name, rule_type, scoring_rule_type, active, number_of_players, first_round_weeks`,
    [
      leagueId,
      normalizedName,
      ruleType,
      scoringRuleType,
      normalizedActive,
      numberOfPlayers,
      firstRoundWeeks,
      session.userId,
    ],
  );

  if (updated.rowCount === 0) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      updated: true,
      league: updated.rows[0],
      message: "League updated successfully.",
    },
  });
}
