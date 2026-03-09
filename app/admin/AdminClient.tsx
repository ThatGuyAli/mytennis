"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError, getAdminDashboard, logoutAdmin, upsertAdminSet } from "@/lib/api";
import type { League, MatchStatus, Player } from "@/types";

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

type DashboardData = {
  user: {
    id: string;
    username: string;
  };
  leagues: League[];
  players: Player[];
  assignments: LeagueAssignment[];
  matches: MatchRow[];
  sets: SetRow[];
};

type NoticeType = "success" | "error" | "info";

type NoticeState = {
  type: NoticeType;
  message: string;
} | null;

type InlineSetFormRow = {
  set_number: number;
  player1_games: string;
  player2_games: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not played yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function noticeClassName(type: NoticeType) {
  if (type === "success") {
    return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
  }
  if (type === "error") {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  }
  return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
}

export function AdminClient() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [editingResultMatchId, setEditingResultMatchId] = useState("");
  const [editingResultRuleType, setEditingResultRuleType] =
    useState<League["rule_type"]>("three_sets");
  const [inlineSetRows, setInlineSetRows] = useState<InlineSetFormRow[]>([
    { set_number: 1, player1_games: "0", player2_games: "0" },
    { set_number: 2, player1_games: "0", player2_games: "0" },
    { set_number: 3, player1_games: "0", player2_games: "0" },
  ]);

  function showNotice(type: NoticeType, message: string) {
    setNotice({ type, message });
  }

  const setsByMatch = useMemo(() => {
    const map = new Map<string, SetRow[]>();
    for (const set of dashboard?.sets ?? []) {
      const current = map.get(set.match_id) ?? [];
      current.push(set);
      map.set(set.match_id, current);
    }
    return map;
  }, [dashboard?.sets]);

  const matchesByLeague = useMemo(() => {
    if (!dashboard) return [] as { league: League; matches: MatchRow[] }[];
    return dashboard.leagues.map((league) => ({
      league,
      matches: dashboard.matches
        .filter((match) => match.league_id === league.id)
        .sort((a, b) => a.week_number - b.week_number),
    }));
  }, [dashboard]);


  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const payload = await getAdminDashboard<DashboardData>();
      setDashboard(payload);
    } catch (errorObject) {
      if (errorObject instanceof ApiError && errorObject.status === 401) {
        showNotice("error", "Session expired. Please log in again.");
        router.push("/login");
        router.refresh();
        return;
      }
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Unable to load dashboard.";
      setError(message);
      showNotice("error", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function parseSetValue(value: string) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : NaN;
  }

  function whoWonSet(player1Games: string, player2Games: string) {
    const p1 = parseSetValue(player1Games);
    const p2 = parseSetValue(player2Games);
    if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0 || p1 === p2) {
      return 0;
    }
    return p1 > p2 ? 1 : 2;
  }

  function isTieBreakThirdSetActive(rows: InlineSetFormRow[]) {
    const firstWinner = whoWonSet(rows[0]?.player1_games ?? "", rows[0]?.player2_games ?? "");
    const secondWinner = whoWonSet(rows[1]?.player1_games ?? "", rows[1]?.player2_games ?? "");
    return firstWinner !== 0 && secondWinner !== 0 && firstWinner !== secondWinner;
  }

  function startInlineResultEdit(matchId: string, leagueId: string, matchSets: SetRow[]) {
    const league = dashboard?.leagues.find((item) => item.id === leagueId);
    const ruleType = league?.rule_type ?? "three_sets";
    const sortedSets = [...matchSets].sort((a, b) => a.set_number - b.set_number);
    const bySetNumber = new Map(sortedSets.map((set) => [set.set_number, set]));

    setEditingResultMatchId(matchId);
    setEditingResultRuleType(ruleType);
    setInlineSetRows([
      {
        set_number: 1,
        player1_games: String(bySetNumber.get(1)?.player1_games ?? 0),
        player2_games: String(bySetNumber.get(1)?.player2_games ?? 0),
      },
      {
        set_number: 2,
        player1_games: String(bySetNumber.get(2)?.player1_games ?? 0),
        player2_games: String(bySetNumber.get(2)?.player2_games ?? 0),
      },
      {
        set_number: 3,
        player1_games: String(bySetNumber.get(3)?.player1_games ?? 0),
        player2_games: String(bySetNumber.get(3)?.player2_games ?? 0),
      },
    ]);
  }

  function cancelInlineResultEdit() {
    setEditingResultMatchId("");
    setEditingResultRuleType("three_sets");
    setInlineSetRows([
      { set_number: 1, player1_games: "0", player2_games: "0" },
      { set_number: 2, player1_games: "0", player2_games: "0" },
      { set_number: 3, player1_games: "0", player2_games: "0" },
    ]);
  }

  function updateInlineSetRow(
    setNumber: number,
    side: "player1_games" | "player2_games",
    value: string,
  ) {
    setInlineSetRows((prev) =>
      prev.map((row) => (row.set_number === setNumber ? { ...row, [side]: value } : row)),
    );
  }

  async function saveInlineResult(matchId: string) {
    const tieBreakEnabled = isTieBreakThirdSetActive(inlineSetRows);
    const rowsToSave =
      editingResultRuleType === "two_sets_tiebreak"
        ? tieBreakEnabled
          ? inlineSetRows
          : inlineSetRows.slice(0, 2)
        : inlineSetRows;

    for (const row of rowsToSave) {
      const player1Games = Number(row.player1_games);
      const player2Games = Number(row.player2_games);
      if (!Number.isInteger(player1Games) || !Number.isInteger(player2Games)) {
        showNotice("error", `Set ${row.set_number}: games must be integers.`);
        return;
      }
      if (player1Games < 0 || player2Games < 0) {
        showNotice("error", `Set ${row.set_number}: games cannot be negative.`);
        return;
      }
    }

    setBusy(true);
    setNotice(null);
    try {
      for (const row of rowsToSave) {
        await upsertAdminSet({
          match_id: matchId,
          set_number: row.set_number,
          player1_games: Number(row.player1_games),
          player2_games: Number(row.player2_games),
          is_tiebreak: editingResultRuleType === "two_sets_tiebreak" && row.set_number === 3,
        });
      }
      await loadDashboard();
      showNotice("success", "Match result saved successfully.");
      cancelInlineResultEdit();
    } catch (errorObject) {
      showNotice(
        "error",
        errorObject instanceof Error ? errorObject.message : "Failed to save match result.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await logoutAdmin();
      showNotice("info", "Logged out successfully.");
      router.push("/login");
      router.refresh();
    } catch (errorObject) {
      showNotice(
        "error",
        errorObject instanceof Error ? errorObject.message : "Logout failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading dashboard...</p>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error || "Unable to load dashboard."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-md ${noticeClassName(notice.type)}`}
          >
            <div className="flex items-center gap-3">
              <span>{notice.message}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded px-1 text-xs opacity-70 hover:opacity-100"
              >
                x
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onLogout()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">League Section</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          View league details or create a new league.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/admin/leagues"
            className="inline-flex rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View League Details
          </Link>
                    <Link
            href="/admin/leagues/create"
            className="inline-flex rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Create New League
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Players Section</h2>

        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          View players list or add a new player.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/players"
            className="inline-flex rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View Players
          </Link>
          <Link
            href="/admin/players/create"
            className="inline-flex rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Add New Player
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Matches Overview</h2>
        <div className="mt-3 space-y-4">
          {matchesByLeague.map(({ league, matches }) => (
            <div
              key={league.id}
              className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <h3 className="text-sm font-semibold">{league.name}</h3>
              {matches.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">No matches yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="px-1 py-1.5 text-left sm:px-3 sm:py-2" rowSpan={2}>
                          Wk
                        </th>
                        <th className="px-1 py-1.5 text-left sm:px-3 sm:py-2" rowSpan={2}>
                          Match
                        </th>
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2" colSpan={3}>
                          Result
                        </th>
                        <th className="px-1 py-1.5 text-right sm:px-3 sm:py-2" rowSpan={2}>
                          Action
                        </th>
                      </tr>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2">Set 1</th>
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2">Set 2</th>
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2">
                          {league.rule_type === "two_sets_tiebreak" ? "Tie-break" : "Set 3"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => {
                        const matchSets = setsByMatch.get(match.id) ?? [];
                        const setScores = [1, 2, 3].map((setNumber) => {
                          const set = matchSets.find((item) => item.set_number === setNumber);
                          return set ? `${set.player1_games}-${set.player2_games}` : "-";
                        });
                        const isEditingRow = editingResultMatchId === match.id;
                        const tieBreakEnabled =
                          editingResultRuleType === "two_sets_tiebreak"
                            ? isTieBreakThirdSetActive(inlineSetRows)
                            : false;

                        return (
                          <Fragment key={match.id}>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800">
                              <td className="px-2 py-1.5 sm:px-3 sm:py-2">{match.week_number}</td>
                              <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                                <div>{match.player1_name}</div><div>{match.player2_name}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatDate(match.played_at)}
                                </div>
                                {isEditingRow && editingResultRuleType === "two_sets_tiebreak" ? (
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {tieBreakEnabled
                                      ? "Tie-break active (1-1 after two sets)"
                                      : "Tie-break unlocks when sets are 1-1"}
                                  </div>
                                ) : null}
                              </td>
                              {[1, 2, 3].map((setNumber, index) => {
                                const editingSet = inlineSetRows.find(
                                  (row) => row.set_number === setNumber,
                                );
                                const isThirdSetTieBreak =
                                  editingResultRuleType === "two_sets_tiebreak" && setNumber === 3;
                                const isDisabled = isEditingRow && isThirdSetTieBreak && !tieBreakEnabled;

                                return (
                                  <td
                                    key={`${match.id}-set-${index}`}
                                    className="px-2 py-1.5 text-center sm:px-3 sm:py-2"
                                  >
                                    {isEditingRow ? (
                                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={editingSet?.player1_games ?? "0"}
                                          onChange={(event) =>
                                            updateInlineSetRow(
                                              setNumber,
                                              "player1_games",
                                              event.target.value,
                                            )
                                          }
                                          disabled={isDisabled}
                                          className="w-10 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                      
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={editingSet?.player2_games ?? "0"}
                                          onChange={(event) =>
                                            updateInlineSetRow(
                                              setNumber,
                                              "player2_games",
                                              event.target.value,
                                            )
                                          }
                                          disabled={isDisabled}
                                          className="w-10 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                      </div>
                                    ) : (
                                      setScores[index]
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">
                                {isEditingRow ? (
                                  <div className="flex flex-col sm:flex-row justify-end gap-1 sm:gap-2">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void saveInlineResult(match.id)}
                                      className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:bg-zinc-100 dark:text-zinc-900"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => cancelInlineResultEdit()}
                                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:border-zinc-700 dark:hover:bg-zinc-900"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      startInlineResultEdit(match.id, match.league_id, matchSets)
                                    }
                                    className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:border-zinc-700 dark:hover:bg-zinc-900"
                                  >
                                    {matchSets.length > 0 ? "Edit" : "Set"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
