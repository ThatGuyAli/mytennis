import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export async function GET() {
  const leagues = await query<{
    id: string;
    name: string;
    scoring_rule_type: number;
  }>(
    `SELECT id, name, scoring_rule_type
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
