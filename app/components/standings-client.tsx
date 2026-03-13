"use client";

import { useEffect, useMemo, useState } from "react";

import { MatchesOverviewSection } from "@/app/components/matches-overview-section";
import { getPublicStandingsLeagueDetails, getPublicStandingsLeagues } from "@/lib/api";
import { buildLeagueStandings, type ComputedStandingRow } from "@/lib/standings";
import { APP_COLORS } from "@/lib/theme-colors";

type LeagueRow = {
  id: string;
  name: string;
  rule_type: "three_sets" | "two_sets_tiebreak";
  first_round_weeks: number;
  scoring_rule_type: number;
};

type LeagueDetailsPayload = {
  league: LeagueRow;
  players: Array<{ id: string; name: string }>;
  matches: Array<{
    id: string;
    week_number: number;
    status: "scheduled" | "completed" | "dnf" | "dns";
    played_at: string | null;
    player1_id: string;
    player2_id: string;
    player1_name: string;
    player2_name: string;
  }>;
  sets: Array<{
    match_id: string;
    set_number: number;
    player1_games: number;
    player2_games: number;
    is_tiebreak: boolean;
  }>;
};

type NoticeType = "error";
type Notice = { type: NoticeType; message: string } | null;

function noticeClassName(type: NoticeType) {
  if (type === "error") {
    return "border-red-300 bg-red-50 text-red-800";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-800";
}

export function StandingsClient() {
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [standings, setStandings] = useState<ComputedStandingRow[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<keyof ComputedStandingRow>("position");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedWeekByLeague, setSelectedWeekByLeague] = useState<Record<string, number>>({});
  const [selectedLeagueDetails, setSelectedLeagueDetails] = useState<LeagueDetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const selectedLeagueName = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId)?.name ?? "",
    [leagues, selectedLeagueId],
  );

  const sortedStandings = useMemo(() => {
    const rows = [...standings];
    rows.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      let result = 0;

      if (typeof aValue === "string" && typeof bValue === "string") {
        result = aValue.localeCompare(bValue);
      } else {
        result = Number(aValue) - Number(bValue);
      }

      return sortDirection === "asc" ? result : -result;
    });
    return rows;
  }, [standings, sortBy, sortDirection]);

  function onSort(column: keyof ComputedStandingRow) {
    if (sortBy === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function sortLabel(column: keyof ComputedStandingRow, label: string) {
    if (sortBy !== column) return label;
    return `${label} ${sortDirection === "asc" ? "▲" : "▼"}`;
  }

  async function loadLeagues() {
    const data = await getPublicStandingsLeagues<{ leagues: LeagueRow[] }>();
    setLeagues(data.leagues);
  }

  async function loadStandingsForLeague(leagueId: string) {
    if (!leagueId) {
      setStandings([]);
      setSelectedLeagueDetails(null);
      return;
    }

    const details = await getPublicStandingsLeagueDetails<LeagueDetailsPayload>(leagueId);
    setSelectedLeagueDetails(details);
    const table = buildLeagueStandings(
      details.players,
      details.matches,
      details.sets,
      details.league.scoring_rule_type,
    );
    setStandings(table);
  }

  useEffect(() => {
    setLoading(true);
    setNotice(null);
    void loadLeagues()
      .catch((errorObject) => {
        setNotice({
          type: "error",
          message:
            errorObject instanceof Error ? errorObject.message : "Failed to load leagues.",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function onLeagueChange(nextLeagueId: string) {
    setSelectedLeagueId(nextLeagueId);
    setNotice(null);
    setLoading(true);
    try {
      await loadStandingsForLeague(nextLeagueId);
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to load standings.",
      });
    } finally {
      setLoading(false);
    }
  }

  function getDefaultWeekForLeague(
    league: { id: string; name: string; rule_type: "three_sets" | "two_sets_tiebreak"; first_round_weeks: number },
    matches: Array<{ week_number: number; played_at: string | null }>,
  ): number {
    if (matches.length === 0) return 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekDates = new Map<number, number>();
    for (const m of matches) {
      if (!m.played_at) continue;
      const d = new Date(m.played_at).getTime();
      const current = weekDates.get(m.week_number);
      if (current === undefined || d < current) weekDates.set(m.week_number, d);
    }
    let soonestFutureWeek: number | null = null;
    let soonestFutureTime = Infinity;
    let mostRecentPastWeek: number | null = null;
    let mostRecentPastTime = -Infinity;
    for (const [week, time] of weekDates) {
      if (time >= today.getTime() && time < soonestFutureTime) {
        soonestFutureWeek = week;
        soonestFutureTime = time;
      }
      if (time < today.getTime() && time > mostRecentPastTime) {
        mostRecentPastWeek = week;
        mostRecentPastTime = time;
      }
    }
    return soonestFutureWeek ?? mostRecentPastWeek ?? 1;
  }

  const matchesByLeague = useMemo(() => {
    if (!selectedLeagueDetails?.league) return [] as Array<{
      league: LeagueRow;
      matches: Array<{
        id: string;
        league_id: string;
        league_name: string;
        player1_name: string;
        player2_name: string;
        week_number: number;
        played_at: string | null;
        status: "scheduled" | "completed" | "dnf" | "dns";
      }>;
    }>;

    return [
      {
        league: selectedLeagueDetails.league,
        matches: selectedLeagueDetails.matches.map((match) => ({
          ...match,
          league_id: selectedLeagueDetails.league.id,
          league_name: selectedLeagueDetails.league.name,
        })),
      },
    ];
  }, [selectedLeagueDetails]);

  return (
    <section className="relative mx-auto max-w-6xl space-y-6 py-8">
      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-md ${noticeClassName(notice.type)}`}
          >
            {notice.message}
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold" style={{ color: APP_COLORS.login.title }}>
          League Standings
        </h1>
      </header>

      <section
        className="rounded-2xl border p-4 shadow-xl"
        style={{
          backgroundColor: APP_COLORS.login.panelBackground,
          borderColor: APP_COLORS.login.panelBorder,
          boxShadow: `0 24px 56px ${APP_COLORS.login.panelShadow}`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
            Select League
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="rounded-lg border px-3 py-1 text-xs hover:bg-white/70"
              style={{ borderColor: APP_COLORS.login.panelBorder, color: APP_COLORS.login.subtitle }}
            >
              {isExpanded ? "Collapse Columns" : "Expand Columns"}
            </button>
          </div>
        </div>
        <div className="mt-3 max-w-md">
          <select
            value={selectedLeagueId}
            onChange={(event) => void onLeagueChange(event.target.value)}
            disabled={loading}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: APP_COLORS.login.panelBorder }}
          >
            <option value="">Select the league</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: APP_COLORS.login.panelBorder }}>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("position")} className="hover:underline">
                    {sortLabel("position", "RK")}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("player_name")} className="hover:underline">
                    {sortLabel("player_name", "PL")}
                  </button>
                </th>
                {isExpanded ? (
                  <th className="px-3 py-2 text-center">
                    <button type="button" onClick={() => onSort("points")} className="hover:underline">
                      {sortLabel("points", "PTS")}
                    </button>
                  </th>
                ) : null}
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => onSort("matches_played")} className="hover:underline">
                    {sortLabel("matches_played", "MP")}
                  </button>
                </th>
                {isExpanded ? (
                  <>
                    <th className="px-3 py-2 text-center">M W-L-D</th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("sets_won")} className="hover:underline">
                        S W/L
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onSort("set_win_loss_percentage")}
                        className="hover:underline"
                      >
                        {sortLabel("set_win_loss_percentage", "S%")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onSort("game_win_loss_percentage")}
                        className="hover:underline"
                      >
                        {sortLabel("game_win_loss_percentage", "G%")}
                      </button>
                    </th>
                  </>
                ) : null}
                {!isExpanded ? (
                  <th className="px-3 py-2 text-center">
                    <button type="button" onClick={() => onSort("points")} className="hover:underline">
                      {sortLabel("points", "PTS")}
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 8 : 4} style={{ color: APP_COLORS.login.subtitle }}>
                    Loading standings...
                  </td>
                </tr>
              ) : !selectedLeagueId ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 8 : 4} style={{ color: APP_COLORS.login.subtitle }}>
                    Select a league to view standings.
                  </td>
                </tr>
              ) : standings.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 8 : 4} style={{ color: APP_COLORS.login.subtitle }}>
                    No standings yet for {selectedLeagueName || "this league"}.
                  </td>
                </tr>
              ) : (
                sortedStandings.map((row, index) => (
                  <tr
                    key={row.player_id}
                    className={`border-b transition-colors hover:bg-blue-50/80 ${index % 2 === 1 ? "bg-zinc-50/80" : "bg-white"}`}
                    style={{ borderColor: APP_COLORS.login.panelBorder }}
                  >
                    <td className="px-3 py-2">{row.position}</td>
                    <td className="px-3 py-2">{row.player_name}</td>
                    {isExpanded ? <td className="px-3 py-2 text-center font-medium">{row.points}</td> : null}
                    <td className="px-3 py-2 text-center">{row.matches_played}</td>
                    {isExpanded ? (
                      <>
                        <td className="px-3 py-2 text-center">
                          {row.matches_won}-{row.matches_lost}-{row.matches_drawn}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.sets_won}/{row.sets_lost}
                        </td>
                        <td className="px-3 py-2 text-center">{row.set_win_loss_percentage}%</td>
                        <td className="px-3 py-2 text-center">{row.game_win_loss_percentage}%</td>
                      </>
                    ) : null}
                    {!isExpanded ? <td className="px-3 py-2 text-center font-medium">{row.points}</td> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div
          className="mt-3 rounded-lg border p-3 text-xs"
          style={{
            borderColor: APP_COLORS.login.panelBorder,
            color: APP_COLORS.login.subtitle,
            backgroundColor: "#ffffffcc",
          }}
        >
          <p className="font-semibold">Column guide:</p>
          <p>RK = Ranking</p>
          <p>PL = Player</p>
          <p>MP = Matches Played</p>
          <p>PTS = Points</p>
          <p>M W-L-D = Match record (Won-Lost-Drawn)</p>
          <p>S W/L = Sets Won/Lost</p>
          <p>S% = Set Win/Loss Percentage</p>
          <p>G% = Game Win/Loss Percentage</p>
        </div>
      </section>

      {selectedLeagueDetails ? (
        <MatchesOverviewSection
          title="Matches Overview"
          readOnly
          matchesByLeague={matchesByLeague}
          selectedWeekByLeague={selectedWeekByLeague}
          onChangeLeagueWeek={(leagueId, week) =>
            setSelectedWeekByLeague((prev) => ({ ...prev, [leagueId]: week }))
          }
          getDefaultWeekForLeague={getDefaultWeekForLeague}
          setsByMatch={new Map(
            selectedLeagueDetails.sets.reduce<Array<[string, LeagueDetailsPayload["sets"]]>>(
              (acc, set) => {
                const existing = acc.find(([matchId]) => matchId === set.match_id);
                if (existing) {
                  existing[1].push(set);
                } else {
                  acc.push([set.match_id, [set]]);
                }
                return acc;
              },
              [],
            ),
          )}
          editingResultMatchId=""
          editingResultRuleType="three_sets"
          inlineSetRows={[
            { set_number: 1, player1_games: "0", player2_games: "0" },
            { set_number: 2, player1_games: "0", player2_games: "0" },
            { set_number: 3, player1_games: "0", player2_games: "0" },
          ]}
          inlineResultIsDns={false}
          inlineResultIsDnf={false}
          busy={false}
          isTieBreakThirdSetActive={() => false}
          updateInlineSetRow={() => {}}
          setInlineResultIsDnf={() => {}}
          setInlineResultIsDns={() => {}}
          onSaveInlineResult={async () => {}}
          onCancelInlineResultEdit={() => {}}
          onStartInlineResultEdit={() => {}}
        />
      ) : null}
    </section>
  );
}
