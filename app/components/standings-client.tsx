"use client";

import { useEffect, useMemo, useState } from "react";

import { getPublicStandingsLeagueDetails, getPublicStandingsLeagues } from "@/lib/api";
import { buildLeagueStandings, type ComputedStandingRow } from "@/lib/standings";
import { APP_COLORS } from "@/lib/theme-colors";

type LeagueRow = {
  id: string;
  name: string;
  scoring_rule_type: number;
};

type LeagueDetailsPayload = {
  league: LeagueRow;
  players: Array<{ id: string; name: string }>;
  matches: Array<{ id: string; player1_id: string; player2_id: string }>;
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
      return;
    }

    const details = await getPublicStandingsLeagueDetails<LeagueDetailsPayload>(leagueId);
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
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-lg border px-3 py-1 text-xs hover:bg-white/70"
            style={{ borderColor: APP_COLORS.login.panelBorder, color: APP_COLORS.login.subtitle }}
          >
            {isExpanded ? "Collapse Columns" : "Expand Columns"}
          </button>
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
                    {sortLabel("position", "#")}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("player_name")} className="hover:underline">
                    {sortLabel("player_name", "Player")}
                  </button>
                </th>
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => onSort("matches_played")} className="hover:underline">
                    {sortLabel("matches_played", "MP")}
                  </button>
                </th>
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => onSort("sets_won")} className="hover:underline">
                    {sortLabel("sets_won", "SW")}
                  </button>
                </th>
                {isExpanded ? (
                  <>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("matches_won")} className="hover:underline">
                        {sortLabel("matches_won", "W")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("matches_lost")} className="hover:underline">
                        {sortLabel("matches_lost", "L")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("matches_drawn")} className="hover:underline">
                        {sortLabel("matches_drawn", "D")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("sets_lost")} className="hover:underline">
                        {sortLabel("sets_lost", "Sets L")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("win_percentage")} className="hover:underline">
                        {sortLabel("win_percentage", "Win %")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button type="button" onClick={() => onSort("loss_percentage")} className="hover:underline">
                        {sortLabel("loss_percentage", "Loss %")}
                      </button>
                    </th>
                  </>
                ) : null}
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => onSort("points")} className="hover:underline">
                    {sortLabel("points", "Points")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 11 : 5} style={{ color: APP_COLORS.login.subtitle }}>
                    Loading standings...
                  </td>
                </tr>
              ) : !selectedLeagueId ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 11 : 5} style={{ color: APP_COLORS.login.subtitle }}>
                    Select a league to view standings.
                  </td>
                </tr>
              ) : standings.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={isExpanded ? 11 : 5} style={{ color: APP_COLORS.login.subtitle }}>
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
                    <td className="px-3 py-2 text-center">{row.matches_played}</td>
                    <td className="px-3 py-2 text-center">{row.sets_won}</td>
                    {isExpanded ? (
                      <>
                        <td className="px-3 py-2 text-center">{row.matches_won}</td>
                        <td className="px-3 py-2 text-center">{row.matches_lost}</td>
                        <td className="px-3 py-2 text-center">{row.matches_drawn}</td>
                        <td className="px-3 py-2 text-center">{row.sets_lost}</td>
                        <td className="px-3 py-2 text-center">{row.win_percentage}%</td>
                        <td className="px-3 py-2 text-center">{row.loss_percentage}%</td>
                      </>
                    ) : null}
                    <td className="px-3 py-2 text-center font-medium">{row.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
