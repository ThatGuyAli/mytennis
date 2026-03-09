"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DragEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  attachPlayerToLeague,
  createAdminMatches,
  getAdminDashboard,
  getAdminLeagueDetails,
  removePlayerFromLeague as removePlayerFromLeagueApi,
  updateAdminLeague,
  updateAdminMatches,
} from "@/lib/api";
import type { League, LeagueRule, MatchStatus, Player } from "@/types";

type LeagueAssignment = {
  id: string;
  league_id: string;
  player_id: string;
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

type DashboardData = {
  leagues: League[];
  players: Player[];
  assignments: LeagueAssignment[];
  matches: MatchRow[];
};

type MatchSlot = {
  player1_id: string | null;
  player2_id: string | null;
};

type WeekDraft = {
  played_at: string;
  slots: MatchSlot[];
  saved: boolean;
};

type NoticeType = "success" | "error";
type Notice = {
  type: NoticeType;
  message: string;
} | null;

type LeaguePlayerRow = {
  id: string;
  name: string;
};

type LeagueMatchRow = {
  id: string;
  week_number: number;
  status: MatchStatus;
  played_at: string | null;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
};

type MatchSetRow = {
  match_id: string;
  set_number: number;
  player1_games: number;
  player2_games: number;
  is_tiebreak: boolean;
};

type LeagueDetails = {
  league: League;
  players: LeaguePlayerRow[];
  matches: LeagueMatchRow[];
  sets: MatchSetRow[];
};

type LeagueUpdateFormState = {
  name: string;
  rule_type: LeagueRule;
  scoring_rule_type: string;
  number_of_players: string;
  first_round_weeks: string;
};

function createEmptySlots(count: number): MatchSlot[] {
  return Array.from({ length: count }, () => ({
    player1_id: null,
    player2_id: null,
  }));
}

function formatDate(value: string | null) {
  if (!value) return "Not played yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function comparePlayedAtAsc(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function noticeClassName(type: NoticeType) {
  if (type === "success") {
    return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
  }
  return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
}

const RULE_LABELS: Record<LeagueRule, string> = {
  three_sets: "Three Sets",
  two_sets_tiebreak: "Two Sets + Tiebreak",
};

const SCORING_RULE_LABELS: Record<number, string> = {
  1: "Rule 1 - Simple (3/0, draw 1)",
  2: "Rule 2 - Weighted Tie-break",
  3: "Rule 3 (Reserved)",
  4: "Rule 4 (Reserved)",
  5: "Rule 5 (Reserved)",
};

export function LeagueWorkflowClient() {
  const router = useRouter();
  const params = useParams<{ leagueName: string }>();
  const searchParams = useSearchParams();
  const initialLeagueName = decodeURIComponent(params.leagueName ?? "");
  const initialLeagueId = searchParams.get("id") ?? "";

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [details, setDetails] = useState<LeagueDetails | null>(null);
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [activePanel, setActivePanel] = useState<"attach" | "matches" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weekDrafts, setWeekDrafts] = useState<Record<number, WeekDraft>>({});
  const [weekNumber, setWeekNumber] = useState(1);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [pendingRemovePlayer, setPendingRemovePlayer] = useState<LeaguePlayerRow | null>(null);
  const [removingPlayerId, setRemovingPlayerId] = useState<string>("");
  const [pendingFinishLeague, setPendingFinishLeague] = useState(false);
  const [isFinishingLeague, setIsFinishingLeague] = useState(false);
  const [isEditingLeague, setIsEditingLeague] = useState(false);
  const [isUpdatingLeague, setIsUpdatingLeague] = useState(false);
  const [editingWeekNumber, setEditingWeekNumber] = useState<number | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string>("");
  const [editingMatchDate, setEditingMatchDate] = useState<string>("");
  const [updatingMatchDateId, setUpdatingMatchDateId] = useState<string>("");
  const matchesEditorRef = useRef<HTMLElement | null>(null);
  const [leagueForm, setLeagueForm] = useState<LeagueUpdateFormState>({
    name: "",
    rule_type: "three_sets",
    scoring_rule_type: "1",
    number_of_players: "",
    first_round_weeks: "",
  });

  const selectedLeague = useMemo(
    () => dashboard?.leagues.find((league) => league.id === leagueId) ?? null,
    [dashboard?.leagues, leagueId],
  );

  const slotCount = selectedLeague
    ? Math.max(1, Math.floor(selectedLeague.number_of_players / 2))
    : 0;
  const maxWeeks = selectedLeague?.first_round_weeks ?? 1;

  const currentWeekDraft: WeekDraft = useMemo(
    () =>
      weekDrafts[weekNumber] ?? {
        played_at: "",
        slots: createEmptySlots(slotCount),
        saved: false,
      },
    [weekDrafts, weekNumber, slotCount],
  );

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set(
      (dashboard?.assignments ?? [])
        .filter((assignment) => assignment.league_id === leagueId)
        .map((assignment) => assignment.player_id),
    );
    return ids;
  }, [dashboard?.assignments, leagueId]);

  const leaguePlayers = useMemo(
    () => (dashboard?.players ?? []).filter((player) => assignedPlayerIds.has(player.id)),
    [dashboard?.players, assignedPlayerIds],
  );

  const availableToAttach = useMemo(
    () => (dashboard?.players ?? []).filter((player) => !assignedPlayerIds.has(player.id)),
    [dashboard?.players, assignedPlayerIds],
  );

  const assignedCount = details?.players.length ?? 0;
  const seatLimit = selectedLeague?.number_of_players ?? 0;
  const remainingSeats = Math.max(0, seatLimit - assignedCount);
  const hasEmptySeat = remainingSeats > 0;

  const usedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of currentWeekDraft.slots) {
      if (slot.player1_id) ids.add(slot.player1_id);
      if (slot.player2_id) ids.add(slot.player2_id);
    }
    return ids;
  }, [currentWeekDraft.slots]);

  const availablePlayersForMatch = useMemo(
    () => leaguePlayers.filter((player) => !usedPlayerIds.has(player.id)),
    [leaguePlayers, usedPlayerIds],
  );

  const temporarySelections = useMemo(() => {
    return Object.entries(weekDrafts)
      .map(([week, draft]) => ({ week: Number(week), draft }))
      .sort((a, b) => a.week - b.week);
  }, [weekDrafts]);

  const allWeeksPrepared = useMemo(() => {
    if (!selectedLeague) return false;
    const requiredWeeks = Array.from(
      { length: selectedLeague.first_round_weeks },
      (_, index) => index + 1,
    );
    return requiredWeeks.every((week) => Boolean(weekDrafts[week]?.saved));
  }, [selectedLeague, weekDrafts]);

  async function loadDashboardData() {
    return getAdminDashboard<DashboardData>();
  }

  async function loadLeagueDetails(targetLeagueId: string) {
    return getAdminLeagueDetails<LeagueDetails>(targetLeagueId);
  }

  async function refreshAll() {
    const dashboardData = await loadDashboardData();
    setDashboard(dashboardData);

    let resolvedLeagueId = leagueId;
    if (!resolvedLeagueId) {
      const byName = dashboardData.leagues.find(
        (league) => league.name.toLowerCase() === initialLeagueName.toLowerCase(),
      );
      resolvedLeagueId = byName?.id ?? "";
      setLeagueId(resolvedLeagueId);
    }

    if (!resolvedLeagueId) {
      setDetails(null);
      throw new Error("League not found.");
    }

    const detailsData = await loadLeagueDetails(resolvedLeagueId);
    setDetails(detailsData);
  }

  useEffect(() => {
    setLoading(true);
    void refreshAll()
      .catch((errorObject) => {
        setNotice({
          type: "error",
          message: errorObject instanceof Error ? errorObject.message : "Failed to load league.",
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLeague) {
      setWeekDrafts({});
      return;
    }
    setWeekNumber(1);
    setWeekDrafts({
      1: { played_at: "", slots: createEmptySlots(slotCount), saved: false },
    });
  }, [leagueId, selectedLeague, slotCount]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!details?.league) return;
    setLeagueForm({
      name: details.league.name,
      rule_type: details.league.rule_type,
      scoring_rule_type: String(details.league.scoring_rule_type ?? 1),
      number_of_players: String(details.league.number_of_players),
      first_round_weeks: String(details.league.first_round_weeks),
    });
    setIsEditingLeague(false);
  }, [details?.league]);

  useEffect(() => {
    if (activePanel !== "matches") return;
    if (!matchesEditorRef.current) return;
    matchesEditorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activePanel, editingWeekNumber]);

  function updateCurrentWeekDraft(updater: (draft: WeekDraft) => WeekDraft) {
    setWeekDrafts((prev) => {
      const current =
        prev[weekNumber] ?? {
          played_at: "",
          slots: createEmptySlots(slotCount),
          saved: false,
        };
      return {
        ...prev,
        [weekNumber]: updater(current),
      };
    });
  }

  function assignPlayerToSlot(
    slotIndex: number,
    side: "player1_id" | "player2_id",
    playerId: string,
  ) {
    updateCurrentWeekDraft((draft) => {
      const alreadyUsed = draft.slots.some(
        (slot, index) =>
          index !== slotIndex &&
          (slot.player1_id === playerId || slot.player2_id === playerId),
      );
      if (alreadyUsed) {
        setNotice({ type: "error", message: "A player can only be used once per week." });
        return draft;
      }
      return {
        ...draft,
        saved: false,
        slots: draft.slots.map((slot, index) =>
          index === slotIndex ? { ...slot, [side]: playerId } : slot,
        ),
      };
    });
  }

  function clearSlotSide(slotIndex: number, side: "player1_id" | "player2_id") {
    updateCurrentWeekDraft((draft) => ({
      ...draft,
      saved: false,
      slots: draft.slots.map((slot, index) =>
        index === slotIndex ? { ...slot, [side]: null } : slot,
      ),
    }));
  }

  function assignPlayerToFirstEmptySlot(playerId: string) {
    for (let slotIndex = 0; slotIndex < currentWeekDraft.slots.length; slotIndex += 1) {
      const slot = currentWeekDraft.slots[slotIndex];

      if (!slot.player1_id && slot.player2_id !== playerId) {
        assignPlayerToSlot(slotIndex, "player1_id", playerId);
        return;
      }

      if (!slot.player2_id && slot.player1_id !== playerId) {
        assignPlayerToSlot(slotIndex, "player2_id", playerId);
        return;
      }
    }

    setNotice({ type: "error", message: "No empty slot is available for this player." });
  }

  async function onAttachPlayerSubmit(formData: FormData) {
    if (!leagueId) return;
    if (!hasEmptySeat) {
      setNotice({
        type: "error",
        message:
          "This league has no empty seats. You can only attach players when seats are available.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await attachPlayerToLeague(leagueId, (formData.get("player_id") as string | null) ?? "");
      await refreshAll();
      setNotice({ type: "success", message: "Player attached successfully." });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to attach player.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removePlayerFromLeague(player: LeaguePlayerRow) {
    if (!leagueId) return;

    setRemovingPlayerId(player.id);
    setNotice(null);
    try {
      const payload = await removePlayerFromLeagueApi(leagueId, player.id);
      await refreshAll();
      setNotice({
        type: "success",
        message: payload.message ?? "Player removed from league successfully.",
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to remove player.",
      });
    } finally {
      setRemovingPlayerId("");
      setPendingRemovePlayer(null);
    }
  }

  async function updateLeagueSettings() {
    if (!isEditingLeague) return;
    if (!leagueId) return;

    setIsUpdatingLeague(true);
    setNotice(null);
    try {
      const payload = await updateAdminLeague({
        league_id: leagueId,
        name: leagueForm.name,
        rule_type: leagueForm.rule_type,
        scoring_rule_type: Number(leagueForm.scoring_rule_type),
        number_of_players: Number(leagueForm.number_of_players),
        first_round_weeks: Number(leagueForm.first_round_weeks),
      });
      await refreshAll();
      setNotice({
        type: "success",
        message: payload.message ?? "League updated successfully.",
      });
      setIsEditingLeague(false);
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to update league.",
      });
    } finally {
      setIsUpdatingLeague(false);
    }
  }

  async function finishLeague() {
    if (!leagueId || !details?.league) return;

    setIsFinishingLeague(true);
    setNotice(null);
    try {
      const payload = await updateAdminLeague({ league_id: leagueId, active: 0 });
      setNotice({
        type: "success",
        message: payload.message ?? "League finished successfully.",
      });
      setPendingFinishLeague(false);
      router.push("/admin");
      router.refresh();
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to finish league.",
      });
    } finally {
      setIsFinishingLeague(false);
    }
  }

  function saveWeekTemporarily() {
    if (!selectedLeague) {
      setNotice({ type: "error", message: "League is not loaded." });
      return;
    }
    if (!currentWeekDraft.played_at) {
      setNotice({ type: "error", message: "Please select a date before saving temporarily." });
      return;
    }
    const completedMatches = currentWeekDraft.slots.filter(
      (slot) => slot.player1_id && slot.player2_id,
    );
    if (completedMatches.length === 0) {
      setNotice({ type: "error", message: `Please assign players in week ${weekNumber}.` });
      return;
    }
    const hasIncomplete = currentWeekDraft.slots.some(
      (slot) => Boolean(slot.player1_id) !== Boolean(slot.player2_id),
    );
    if (hasIncomplete) {
      setNotice({
        type: "error",
        message: "Each started slot must have both players assigned.",
      });
      return;
    }

    const currentWeek = weekNumber;
    const nextWeek = currentWeek < maxWeeks ? currentWeek + 1 : currentWeek;

    setWeekDrafts((prev) => {
      const current =
        prev[currentWeek] ?? {
          played_at: "",
          slots: createEmptySlots(slotCount),
          saved: false,
        };
      const nextDrafts: Record<number, WeekDraft> = {
        ...prev,
        [currentWeek]: { ...current, saved: true },
      };

      if (currentWeek < maxWeeks && !nextDrafts[nextWeek]) {
        nextDrafts[nextWeek] = {
          played_at: "",
          slots: createEmptySlots(slotCount),
          saved: false,
        };
      }

      return nextDrafts;
    });

    if (currentWeek < maxWeeks) {
      setWeekNumber(nextWeek);
      setNotice({
        type: "success",
        message: `Week ${currentWeek} saved temporarily.`,
      });
      return;
    }

    setNotice({ type: "success", message: `Week ${currentWeek} saved temporarily.` });
  }

  function startEditingWeek(week: number, weekMatches: LeagueMatchRow[]) {
    if (!selectedLeague) return;

    const baseSlots: MatchSlot[] = weekMatches.map((match) => ({
      player1_id: match.player1_id,
      player2_id: match.player2_id,
    }));
    const paddedSlots: MatchSlot[] = [...baseSlots];
    while (paddedSlots.length < slotCount) {
      paddedSlots.push({ player1_id: null, player2_id: null });
    }

    setEditingWeekNumber(week);
    setWeekNumber(week);
    setWeekDrafts((prev) => ({
      ...prev,
      [week]: {
        played_at: weekMatches[0]?.played_at ?? "",
        slots: paddedSlots,
        saved: true,
      },
    }));
    setActivePanel("matches");
    setNotice({
      type: "success",
      message: `Editing mode enabled for week ${week}. Update matches and save.`,
    });
  }

  async function saveEditedWeekToDatabase() {
    if (!selectedLeague || editingWeekNumber === null) {
      setNotice({ type: "error", message: "No week is selected for editing." });
      return;
    }
    if (!currentWeekDraft.played_at) {
      setNotice({ type: "error", message: "Please select a date before saving." });
      return;
    }

    const completedMatches = currentWeekDraft.slots.filter(
      (slot) => slot.player1_id && slot.player2_id,
    );
    if (completedMatches.length === 0) {
      setNotice({
        type: "error",
        message: `Please assign at least one complete match for week ${editingWeekNumber}.`,
      });
      return;
    }
    const hasIncomplete = currentWeekDraft.slots.some(
      (slot) => Boolean(slot.player1_id) !== Boolean(slot.player2_id),
    );
    if (hasIncomplete) {
      setNotice({
        type: "error",
        message: "Each started slot must have both players assigned.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const payload = await updateAdminMatches({
        league_id: selectedLeague.id,
        week_number: editingWeekNumber,
        played_at: currentWeekDraft.played_at,
        matches: completedMatches.map((slot) => ({
          player1_id: slot.player1_id as string,
          player2_id: slot.player2_id as string,
        })),
      });
      await refreshAll();
      setWeekDrafts((prev) => {
        const next = { ...prev };
        delete next[editingWeekNumber];
        return next;
      });
      setEditingWeekNumber(null);
      setActivePanel(null);
      setNotice({
        type: "success",
        message: payload.message ?? `Week ${editingWeekNumber} updated successfully.`,
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to update week matches.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveSingleMatchDate(matchId: string) {
    setUpdatingMatchDateId(matchId);
    setNotice(null);
    try {
      const payload = await updateAdminMatches({
        match_id: matchId,
        played_at: editingMatchDate,
      });
      await refreshAll();
      setEditingMatchId("");
      setEditingMatchDate("");
      setNotice({
        type: "success",
        message: payload.message ?? "Match date updated successfully.",
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to update date.",
      });
    } finally {
      setUpdatingMatchDateId("");
    }
  }

  async function saveAllWeeks() {
    if (!selectedLeague) {
      setNotice({ type: "error", message: "League is not loaded." });
      return;
    }

    const requiredWeeks = Array.from(
      { length: selectedLeague.first_round_weeks },
      (_, index) => index + 1,
    );
    for (const week of requiredWeeks) {
      const draft = weekDrafts[week];
      if (!draft || !draft.saved) {
        setNotice({ type: "error", message: `Week ${week} is not saved temporarily yet.` });
        return;
      }
    }

    const weeksPayload = requiredWeeks.map((week) => {
      const draft = weekDrafts[week];
      return {
        week_number: week,
        played_at: draft.played_at,
        matches: draft.slots
          .filter((slot) => slot.player1_id && slot.player2_id)
          .map((slot) => ({
            player1_id: slot.player1_id as string,
            player2_id: slot.player2_id as string,
          })),
      };
    });

    setBusy(true);
    setNotice(null);
    try {
      const payload = await createAdminMatches({ league_id: selectedLeague.id, weeks: weeksPayload });
      await refreshAll();
      setWeekNumber(1);
      setWeekDrafts({});
      setEditingWeekNumber(null);
      setActivePanel(null);
      setNotice({
        type: "success",
        message: payload.message ?? "All week matches saved successfully.",
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Failed to save matches.",
      });
    } finally {
      setBusy(false);
    }
  }

  const setsByMatch = useMemo(() => {
    const map = new Map<string, MatchSetRow[]>();
    for (const set of details?.sets ?? []) {
      const current = map.get(set.match_id) ?? [];
      current.push(set);
      map.set(set.match_id, current);
    }
    return map;
  }, [details?.sets]);

  const matchesByWeek = useMemo(() => {
    const map = new Map<number, LeagueMatchRow[]>();
    for (const match of details?.matches ?? []) {
      const current = map.get(match.week_number) ?? [];
      current.push(match);
      map.set(match.week_number, current);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [details?.matches]);

  const hasSavedAllWeeksInDb = useMemo(() => {
    if (!selectedLeague) return false;
    const requiredWeeks = Array.from(
      { length: selectedLeague.first_round_weeks },
      (_, index) => index + 1,
    );
    const savedWeeks = new Set((details?.matches ?? []).map((match) => match.week_number));
    return requiredWeeks.every((week) => savedWeeks.has(week));
  }, [selectedLeague, details?.matches]);

  const resultColumnLabels = useMemo(() => {
    if (details?.league.rule_type === "two_sets_tiebreak") {
      return ["Set 1", "Set 2", "Tie-break"];
    }
    return ["Set 1", "Set 2", "Set 3"];
  }, [details?.league.rule_type]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading league page...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <ConfirmModal
        isOpen={Boolean(pendingRemovePlayer)}
        title="Confirm Player Removal"
        description={
          pendingRemovePlayer && details?.league
            ? `Are you sure you want to remove "${pendingRemovePlayer.name}" from "${details.league.name}"?`
            : ""
        }
        confirmLabel="Remove Player"
        cancelLabel="Cancel"
        isConfirming={Boolean(removingPlayerId)}
        onCancel={() => setPendingRemovePlayer(null)}
        onConfirm={() => {
          if (pendingRemovePlayer) {
            void removePlayerFromLeague(pendingRemovePlayer);
          }
        }}
      />
      <ConfirmModal
        isOpen={pendingFinishLeague}
        title="Finish League"
        description={
          details?.league
            ? `Are you sure you want to terminate "${details.league.name}"? This will mark the league as inactive.`
            : ""
        }
        confirmLabel="Terminate League"
        cancelLabel="Cancel"
        isConfirming={isFinishingLeague}
        onCancel={() => setPendingFinishLeague(false)}
        onConfirm={() => {
          void finishLeague();
        }}
      />

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
        <div>
          <h1 className="text-2xl font-semibold">{details?.league.name ?? initialLeagueName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {details?.league ? (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">League Details</h2>
              {isEditingLeague ? (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    disabled={isUpdatingLeague}
                    onClick={() => {
                      if (!details?.league) return;
                      setLeagueForm({
                        name: details.league.name,
                        rule_type: details.league.rule_type,
                        scoring_rule_type: String(details.league.scoring_rule_type ?? 1),
                        number_of_players: String(details.league.number_of_players),
                        first_round_weeks: String(details.league.first_round_weeks),
                      });
                      setIsEditingLeague(false);
                    }}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateLeagueSettings()}
                    disabled={isUpdatingLeague}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    {isUpdatingLeague ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner />
                        Updating...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  {details.league.active === 1 ? (
                    <button
                      type="button"
                      onClick={() => setPendingFinishLeague(true)}
                      className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                    >
                      Finish League
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsEditingLeague(true)}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Edit League
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="w-48 px-3 py-2 text-left font-medium">League Name</th>
                    <td className="px-3 py-2">
                      {isEditingLeague ? (
                        <input
                          value={leagueForm.name}
                          onChange={(event) =>
                            setLeagueForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                          required
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      ) : (
                        <span>{details.league.name}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="w-48 px-3 py-2 text-left font-medium">Rule Type</th>
                    <td className="px-3 py-2">
                      {isEditingLeague ? (
                        <select
                          value={leagueForm.rule_type}
                          onChange={(event) =>
                            setLeagueForm((prev) => ({
                              ...prev,
                              rule_type: event.target.value as LeagueRule,
                            }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="three_sets">{RULE_LABELS.three_sets}</option>
                          <option value="two_sets_tiebreak">
                            {RULE_LABELS.two_sets_tiebreak}
                          </option>
                        </select>
                      ) : (
                        <span>{RULE_LABELS[details.league.rule_type]}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="w-48 px-3 py-2 text-left font-medium">Scoring Rule</th>
                    <td className="px-3 py-2">
                      {isEditingLeague ? (
                        <select
                          value={leagueForm.scoring_rule_type}
                          onChange={(event) =>
                            setLeagueForm((prev) => ({
                              ...prev,
                              scoring_rule_type: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="1">{SCORING_RULE_LABELS[1]}</option>
                          <option value="2">{SCORING_RULE_LABELS[2]}</option>
                          <option value="3">{SCORING_RULE_LABELS[3]}</option>
                          <option value="4">{SCORING_RULE_LABELS[4]}</option>
                          <option value="5">{SCORING_RULE_LABELS[5]}</option>
                        </select>
                      ) : (
                        <span>
                          {SCORING_RULE_LABELS[details.league.scoring_rule_type] ??
                            `Rule ${details.league.scoring_rule_type}`}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="w-48 px-3 py-2 text-left font-medium">Players Limit</th>
                    <td className="px-3 py-2">
                      {isEditingLeague ? (
                        <input
                          type="number"
                          min={2}
                          step={1}
                          required
                          value={leagueForm.number_of_players}
                          onChange={(event) =>
                            setLeagueForm((prev) => ({
                              ...prev,
                              number_of_players: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      ) : (
                        <span>{details.league.number_of_players}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th className="w-48 px-3 py-2 text-left font-medium">First Round Weeks</th>
                    <td className="px-3 py-2">
                      {isEditingLeague ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          required
                          value={leagueForm.first_round_weeks}
                          onChange={(event) =>
                            setLeagueForm((prev) => ({
                              ...prev,
                              first_round_weeks: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      ) : (
                        <span>{details.league.first_round_weeks}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activePanel === "attach" ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Attach Players</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Seats used: {assignedCount}/{seatLimit}
          </p>
          {hasEmptySeat ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void onAttachPlayerSubmit(formData);
                event.currentTarget.reset();
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                name="player_id"
                required
                className="min-w-[220px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Select player</option>
                {availableToAttach.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    Attaching...
                  </span>
                ) : (
                  "Attach"
                )}
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This league is full. You can only add players when there is an empty seat.
            </p>
          )}
          {hasEmptySeat ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Remaining seats: {remainingSeats}
            </p>
          ) : null}
        </section>
      ) : null}

      {activePanel === "matches" && selectedLeague ? (
        <section
          ref={matchesEditorRef}
          className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold">
            {editingWeekNumber ? `Edit Week ${editingWeekNumber} Matches` : "Define Matches"}
          </h2>
          {editingWeekNumber ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              You are editing an already saved week. Saving will replace that week&apos;s
              matches.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={weekNumber}
              onChange={(event) => setWeekNumber(Number(event.target.value))}
              className="min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {Array.from({ length: maxWeeks }, (_, index) => {
                const week = index + 1;
                return (
                  <option key={week} value={week}>
                    Week {week}
                  </option>
                );
              })}
            </select>
            <input
              value={currentWeekDraft.played_at}
              onChange={(event) =>
                updateCurrentWeekDraft((draft) => ({
                  ...draft,
                  played_at: event.target.value,
                  saved: false,
                }))
              }
              type="date"
              className="min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Available Players</p>
            <div className="flex flex-wrap gap-2">
              {availablePlayersForMatch.map((player) => (
                <div
                  key={player.id}
                  draggable
                  onDragStart={() => setDraggingPlayerId(player.id)}
                  onDoubleClick={() => assignPlayerToFirstEmptySlot(player.id)}
                  className="cursor-grab rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  title="Drag or double-click to assign"
                >
                  {player.name}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {currentWeekDraft.slots.map((slot, slotIndex) => {
              const player1Name =
                leaguePlayers.find((player) => player.id === slot.player1_id)?.name ?? "";
              const player2Name =
                leaguePlayers.find((player) => player.id === slot.player2_id)?.name ?? "";

              return (
                <div
                  key={slotIndex}
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <p className="mb-2 text-sm font-medium">Match Slot {slotIndex + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                      onDrop={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        if (!draggingPlayerId || slot.player2_id === draggingPlayerId) return;
                        assignPlayerToSlot(slotIndex, "player1_id", draggingPlayerId);
                        setDraggingPlayerId(null);
                      }}
                      className="min-h-12 rounded-md border border-dashed border-zinc-400 p-2 text-sm"
                    >
                      {slot.player1_id ? (
                        <div className="flex items-center justify-between">
                          <span>{player1Name}</span>
                          <button
                            type="button"
                            onClick={() => clearSlotSide(slotIndex, "player1_id")}
                            className="rounded px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            x
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-500">Drop Player 1</span>
                      )}
                    </div>
                    <div
                      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                      onDrop={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        if (!draggingPlayerId || slot.player1_id === draggingPlayerId) return;
                        assignPlayerToSlot(slotIndex, "player2_id", draggingPlayerId);
                        setDraggingPlayerId(null);
                      }}
                      className="min-h-12 rounded-md border border-dashed border-zinc-400 p-2 text-sm"
                    >
                      {slot.player2_id ? (
                        <div className="flex items-center justify-between">
                          <span>{player2Name}</span>
                          <button
                            type="button"
                            onClick={() => clearSlotSide(slotIndex, "player2_id")}
                            className="rounded px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            x
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-500">Drop Player 2</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            {editingWeekNumber ? (
              <button
                type="button"
                onClick={() => void saveEditedWeekToDatabase()}
                disabled={busy}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner />
                    Saving...
                  </span>
                ) : (
                  "Save Edited Week to DB"
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => saveWeekTemporarily()}
                  disabled={busy}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Save Week
                </button>
                {allWeeksPrepared && (
                  <button
                    type="button"
                    onClick={() => void saveAllWeeks()}
                    disabled={busy}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner />
                        Saving...
                      </span>
                    ) : (
                      "Finalize All Matches"
                    )}
                  </button>
                )}
              </>
            )}
            {editingWeekNumber ? (
              <button
                type="button"
                onClick={() => {
                  setEditingWeekNumber(null);
                  setActivePanel(null);
                }}
                disabled={busy}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activePanel === "matches" ? (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Temporary Week Selections</h3>
          {temporarySelections.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              No temporary selections yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {temporarySelections.map(({ week, draft }) => {
                const weekMatches = draft.slots
                  .filter((slot) => slot.player1_id && slot.player2_id)
                  .map((slot) => {
                    const p1 =
                      leaguePlayers.find((player) => player.id === slot.player1_id)?.name ??
                      "Unknown";
                    const p2 =
                      leaguePlayers.find((player) => player.id === slot.player2_id)?.name ??
                      "Unknown";
                    return `${p1} vs ${p2}`;
                  });

                return (
                  <li key={week} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                    <div className="font-medium">
                      Week {week} {draft.saved ? "(Saved Temporarily)" : "(Draft)"}
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-300">
                      Date: {formatDate(draft.played_at || null)}
                    </div>
                    {weekMatches.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc">
                        {weekMatches.map((item) => (
                          <li key={`${week}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                        No complete matches yet.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related Players</h3>
          {hasEmptySeat && (<button
            type="button"
            onClick={() => setActivePanel((prev) => (prev === "attach" ? null : "attach"))}
            disabled={!hasEmptySeat}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Attach Players
          </button>)}
        </div>
        {!hasEmptySeat ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            League is full. Remove a player first to attach a new one.
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {details?.players.length ? (
                details.players.map((player) => (
                  <tr key={player.id} className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2">{player.name}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingRemovePlayer(player)}
                        disabled={Boolean(removingPlayerId)}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                      >
                        {removingPlayerId === player.id ? (
                          <span className="inline-flex items-center gap-2">
                            <LoadingSpinner />
                            Removing...
                          </span>
                        ) : (
                          "Remove"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300" colSpan={2}>
                    No players assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Matches by Week</h3>
          {!hasSavedAllWeeksInDb && (
            <button
              type="button"
              onClick={() => setActivePanel((prev) => (prev === "matches" ? null : "matches"))}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Define Matches
            </button>
          )}
        </div>
        {details?.matches.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No matches created yet.</p>
        ) : (
          <>
            <div className="mt-3 space-y-5 md:hidden">
              {matchesByWeek.map(([week, weekMatches]) => {
                const sortedWeekMatches = [...weekMatches].sort((a, b) =>
                  comparePlayedAtAsc(a.played_at, b.played_at),
                );
                const weekHasResults = weekMatches.some(
                  (match) => (setsByMatch.get(match.id) ?? []).length > 0,
                );

                return (
                  <div key={week}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                        Week {week}
                      </h4>
                      <button
                        type="button"
                        onClick={() => startEditingWeek(week, weekMatches)}
                        disabled={weekHasResults}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        {weekHasResults ? "Edit Week (Locked)" : "Edit Week"}
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {sortedWeekMatches.map((match) => {
                        const sets = setsByMatch.get(match.id) ?? [];
                        const setScores = [1, 2, 3].map((setNumber) => {
                          const set = sets.find((item) => item.set_number === setNumber);
                          return set ? `${set.player1_games}-${set.player2_games}` : "-";
                        });
                        const hasResult = sets.length > 0;
                        const isEditingDate = editingMatchId === match.id;
                        const isUpdatingDate = updatingMatchDateId === match.id;

                        return (
                          <div
                            key={match.id}
                            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                          >
                            <p className="font-medium">
                              {match.player1_name} vs {match.player2_name}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                              <span className="font-medium">Date:</span>{" "}
                              {isEditingDate ? (
                                <input
                                  type="date"
                                  value={editingMatchDate}
                                  onChange={(event) => setEditingMatchDate(event.target.value)}
                                  className="ml-1 w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                                />
                              ) : (
                                formatDate(match.played_at)
                              )}
                            </p>
                            <div className="mt-2">
                              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Result</p>
                              <div className="mt-1 overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                      {resultColumnLabels.map((label) => (
                                        <th key={`${match.id}-${label}`} className="px-2 py-1 text-center">
                                          {label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {setScores.map((score, index) => (
                                        <td
                                          key={`${match.id}-mobile-${index}`}
                                          className="px-2 py-1 text-center text-zinc-700 dark:text-zinc-200"
                                        >
                                          {score}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {isEditingDate ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void saveSingleMatchDate(match.id)}
                                    disabled={isUpdatingDate}
                                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                  >
                                    {isUpdatingDate ? (
                                      <span className="inline-flex items-center gap-2">
                                        <LoadingSpinner />
                                        Saving...
                                      </span>
                                    ) : (
                                      "Save Date"
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMatchId("");
                                      setEditingMatchDate("");
                                    }}
                                    disabled={isUpdatingDate}
                                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : hasResult ? (
                                <button
                                  type="button"
                                  onClick={() => router.push("/admin")}
                                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                >
                                  Edit Result
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMatchId(match.id);
                                    setEditingMatchDate(match.played_at ?? "");
                                  }}
                                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                >
                                  Edit Date
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="px-3 py-2 text-left" rowSpan={2}>
                      Match
                    </th>
                    <th className="px-3 py-2 text-left" rowSpan={2}>
                      Date
                    </th>
                    <th className="px-3 py-2 text-center" colSpan={3}>
                      Result
                    </th>
                    <th className="px-3 py-2 text-right" rowSpan={2}>
                      Action
                    </th>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    {resultColumnLabels.map((label) => (
                      <th key={label} className="px-3 py-2 text-center">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchesByWeek.map(([week, weekMatches]) => {
                    const sortedWeekMatches = [...weekMatches].sort((a, b) =>
                      comparePlayedAtAsc(a.played_at, b.played_at),
                    );
                    const weekHasResults = weekMatches.some(
                      (match) => (setsByMatch.get(match.id) ?? []).length > 0,
                    );

                    return (
                      <Fragment key={week}>
                        <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
                          <td className="px-3 py-2" colSpan={6}>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                                Week {week}
                              </h4>
                              <button
                                type="button"
                                onClick={() => startEditingWeek(week, weekMatches)}
                                disabled={weekHasResults}
                                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                              >
                                {weekHasResults ? "Edit Week (Locked)" : "Edit Week"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {sortedWeekMatches.map((match) => {
                          const sets = setsByMatch.get(match.id) ?? [];
                          const setScores = [1, 2, 3].map((setNumber) => {
                            const set = sets.find((item) => item.set_number === setNumber);
                            return set ? `${set.player1_games}-${set.player2_games}` : "-";
                          });
                          const hasResult = sets.length > 0;
                          const isEditingDate = editingMatchId === match.id;
                          const isUpdatingDate = updatingMatchDateId === match.id;

                          return (
                            <tr key={match.id} className="border-b border-zinc-200 dark:border-zinc-800">
                              <td className="px-3 py-2">
                                {match.player1_name} vs {match.player2_name}
                              </td>
                              <td className="px-3 py-2">
                                {isEditingDate ? (
                                  <input
                                    type="date"
                                    value={editingMatchDate}
                                    onChange={(event) => setEditingMatchDate(event.target.value)}
                                    className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                ) : (
                                  formatDate(match.played_at)
                                )}
                              </td>
                              {setScores.map((score, index) => (
                                <td key={`${match.id}-${index}`} className="px-3 py-2 text-center">
                                  {score}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  {isEditingDate ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void saveSingleMatchDate(match.id)}
                                        disabled={isUpdatingDate}
                                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                      >
                                        {isUpdatingDate ? (
                                          <span className="inline-flex items-center gap-2">
                                            <LoadingSpinner />
                                            Saving...
                                          </span>
                                        ) : (
                                          "Save Date"
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMatchId("");
                                          setEditingMatchDate("");
                                        }}
                                        disabled={isUpdatingDate}
                                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : hasResult ? (
                                    <button
                                      type="button"
                                      onClick={() => router.push("/admin")}
                                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                    >
                                      Edit Result
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMatchId(match.id);
                                        setEditingMatchDate(match.played_at ?? "");
                                      }}
                                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                                    >
                                      Edit Date
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
