"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MatchesOverviewSection } from "@/app/components/matches-overview-section";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ApiError, getAdminDashboard, logoutAdmin, upsertAdminSet } from "@/lib/api";
import { APP_COLORS } from "@/lib/theme-colors";
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
  const [inlineResultIsDnf, setInlineResultIsDnf] = useState(false);
  const [inlineResultIsDns, setInlineResultIsDns] = useState(false);
  const [selectedWeekByLeague, setSelectedWeekByLeague] = useState<Record<string, number>>({});

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

  function getDefaultWeekForLeague(
    league: { id: string; name: string; rule_type: League["rule_type"]; first_round_weeks: number },
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

  function startInlineResultEdit(
    matchId: string,
    leagueId: string,
    matchSets: SetRow[],
    matchStatus?: string,
  ) {
    const league = dashboard?.leagues.find((item) => item.id === leagueId);
    const ruleType = league?.rule_type ?? "three_sets";
    const sortedSets = [...matchSets].sort((a, b) => a.set_number - b.set_number);
    const bySetNumber = new Map(sortedSets.map((set) => [set.set_number, set]));

    setEditingResultMatchId(matchId);
    setEditingResultRuleType(ruleType);
    setInlineResultIsDnf(matchStatus === "dnf");
    setInlineResultIsDns(matchStatus === "dns");
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
    setInlineResultIsDnf(false);
    setInlineResultIsDns(false);
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
      inlineResultIsDns
        ? inlineSetRows.slice(0, 2)
        : editingResultRuleType === "two_sets_tiebreak"
          ? tieBreakEnabled
            ? inlineSetRows
            : inlineSetRows.slice(0, 2)
          : inlineSetRows;

    if (inlineResultIsDns) {
      const s1 = { p1: Number(rowsToSave[0]?.player1_games ?? 0), p2: Number(rowsToSave[0]?.player2_games ?? 0) };
      const s2 = { p1: Number(rowsToSave[1]?.player1_games ?? 0), p2: Number(rowsToSave[1]?.player2_games ?? 0) };
      const set1Valid = (s1.p1 === 6 && s1.p2 === 0) || (s1.p1 === 0 && s1.p2 === 6);
      const set2Valid = (s2.p1 === 6 && s2.p2 === 0) || (s2.p1 === 0 && s2.p2 === 6);
      const both60 = s1.p1 === 6 && s1.p2 === 0 && s2.p1 === 6 && s2.p2 === 0;
      const both06 = s1.p1 === 0 && s1.p2 === 6 && s2.p1 === 0 && s2.p2 === 6;
      if (!set1Valid || !set2Valid || (!both60 && !both06)) {
        showNotice(
          "error",
          "For DNS, both sets must be 6-0 6-0 (player who showed up) or 0-6 0-6 (player who did not).",
        );
        return;
      }
    } else {
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
          is_tiebreak: inlineResultIsDns ? false : editingResultRuleType === "two_sets_tiebreak" && row.set_number === 3,
          status_dnf: inlineResultIsDnf,
          status_dns: inlineResultIsDns,
        });
      }
      await loadDashboard();
      showNotice(
        "success",
        inlineResultIsDns ? "Match marked as DNS (Did Not Show Up)." : "Match result saved successfully.",
      );
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
      <main
        className="relative min-h-screen overflow-hidden px-6 py-10"
        style={{
          background: `linear-gradient(135deg, ${APP_COLORS.login.backgroundFrom} 0%, ${APP_COLORS.login.backgroundTo} 100%)`,
        }}
      >
        <section className="relative mx-auto max-w-6xl space-y-8 py-8">
          <p className="text-sm" style={{ color: APP_COLORS.login.subtitle }}>
            Loading dashboard...
          </p>
        </section>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main
        className="relative min-h-screen overflow-hidden px-6 py-10"
        style={{
          background: `linear-gradient(135deg, ${APP_COLORS.login.backgroundFrom} 0%, ${APP_COLORS.login.backgroundTo} 100%)`,
        }}
      >
        <section className="relative mx-auto max-w-6xl space-y-8 py-8">
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error || "Unable to load dashboard."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden px-6 py-10"
      style={{
        background: `linear-gradient(135deg, ${APP_COLORS.login.backgroundFrom} 0%, ${APP_COLORS.login.backgroundTo} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{ backgroundColor: `${APP_COLORS.brand.primary}33` }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: `${APP_COLORS.brand.secondary}33` }}
      />
      <section className="relative mx-auto max-w-6xl space-y-8 py-8">
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
          <h1 className="text-2xl font-semibold" style={{ color: APP_COLORS.login.title }}>
            Admin Dashboard
          </h1>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="rounded-lg border px-3 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
            style={{
              borderColor: APP_COLORS.login.panelBorder,
              backgroundColor: APP_COLORS.login.panelBackground,
              color: APP_COLORS.login.title,
            }}
          >
            Home
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onLogout()}
            className="rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner />
                Logging out...
              </span>
            ) : (
              "Logout"
            )}
          </button>
        </div>
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
            League Section
          </h2>
        </div>
        <p className="mt-2 text-sm" style={{ color: APP_COLORS.login.subtitle }}>
          View league details or create a new league.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/admin/leagues"
            className="inline-flex rounded-lg border px-4 py-2 text-sm hover:bg-white/70"
            style={{ borderColor: APP_COLORS.login.panelBorder, color: APP_COLORS.login.subtitle }}
          >
            View League Details
          </Link>
                    <Link
            href="/admin/leagues/create"
            className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
            style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
          >
            Create New League
          </Link>
        </div>
      </section>

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
            Players Section
          </h2>

        </div>
        <p className="mt-2 text-sm" style={{ color: APP_COLORS.login.subtitle }}>
          View players list or add a new player.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/admin/players"
            className="inline-flex rounded-lg border px-4 py-2 text-sm hover:bg-white/70"
            style={{ borderColor: APP_COLORS.login.panelBorder, color: APP_COLORS.login.subtitle }}
          >
            View Players
          </Link>
          <Link
            href="/admin/players/create"
            className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
            style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
          >
            Add New Player
          </Link>
        </div>
      </section>

      <MatchesOverviewSection
        matchesByLeague={matchesByLeague}
        selectedWeekByLeague={selectedWeekByLeague}
        onChangeLeagueWeek={(leagueId, week) =>
          setSelectedWeekByLeague((prev) => ({ ...prev, [leagueId]: week }))
        }
        getDefaultWeekForLeague={getDefaultWeekForLeague}
        setsByMatch={setsByMatch}
        editingResultMatchId={editingResultMatchId}
        editingResultRuleType={editingResultRuleType}
        inlineSetRows={inlineSetRows}
        inlineResultIsDns={inlineResultIsDns}
        inlineResultIsDnf={inlineResultIsDnf}
        busy={busy}
        isTieBreakThirdSetActive={isTieBreakThirdSetActive}
        updateInlineSetRow={updateInlineSetRow}
        setInlineResultIsDnf={setInlineResultIsDnf}
        setInlineResultIsDns={setInlineResultIsDns}
        onSaveInlineResult={saveInlineResult}
        onCancelInlineResultEdit={cancelInlineResultEdit}
        onStartInlineResultEdit={startInlineResultEdit}
      />
      </section>
    </main>
  );
}
