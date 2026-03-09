"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { createAdminMatches, getAdminDashboard } from "@/lib/api";
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

type DashboardData = {
  leagues: League[];
  players: Player[];
  assignments: LeagueAssignment[];
  matches: MatchRow[];
};

type NoticeType = "success" | "error";
type NoticeState = {
  type: NoticeType;
  message: string;
} | null;

type MatchSlot = {
  player1_id: string | null;
  player2_id: string | null;
};

type WeekDraft = {
  played_at: string;
  slots: MatchSlot[];
  saved: boolean;
};

function createEmptySlots(count: number): MatchSlot[] {
  return Array.from({ length: count }, () => ({
    player1_id: null,
    player2_id: null,
  }));
}

function noticeClassName(type: NoticeType) {
  if (type === "success") {
    return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
  }
  return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
}

function formatDate(value: string | null) {
  if (!value) return "Not played yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function MatchesClient() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [builderLeagueId, setBuilderLeagueId] = useState("");
  const [builderWeekNumber, setBuilderWeekNumber] = useState(1);
  const [weekDrafts, setWeekDrafts] = useState<Record<number, WeekDraft>>({});
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  function showNotice(type: NoticeType, message: string) {
    setNotice({ type, message });
  }

  const selectedBuilderLeague = useMemo(
    () => dashboard?.leagues.find((league) => league.id === builderLeagueId) ?? null,
    [dashboard?.leagues, builderLeagueId],
  );

  const builderMaxWeek = selectedBuilderLeague?.first_round_weeks ?? 1;
  const builderSlotCount = selectedBuilderLeague
    ? Math.max(1, Math.floor(selectedBuilderLeague.number_of_players / 2))
    : 0;

  const currentWeekDraft: WeekDraft = useMemo(() => {
    return (
      weekDrafts[builderWeekNumber] ?? {
        played_at: "",
        slots: createEmptySlots(builderSlotCount),
        saved: false,
      }
    );
  }, [weekDrafts, builderWeekNumber, builderSlotCount]);

  const leaguePlayersForBuilder = useMemo(() => {
    if (!dashboard || !builderLeagueId) {
      return [] as Player[];
    }

    const playerIds = new Set(
      dashboard.assignments
        .filter((assignment) => assignment.league_id === builderLeagueId)
        .map((assignment) => assignment.player_id),
    );

    return dashboard.players.filter((player) => playerIds.has(player.id));
  }, [dashboard, builderLeagueId]);

  const builderUsedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of currentWeekDraft.slots) {
      if (slot.player1_id) ids.add(slot.player1_id);
      if (slot.player2_id) ids.add(slot.player2_id);
    }
    return ids;
  }, [currentWeekDraft.slots]);

  const availablePlayersForBuilder = useMemo(
    () => leaguePlayersForBuilder.filter((player) => !builderUsedPlayerIds.has(player.id)),
    [leaguePlayersForBuilder, builderUsedPlayerIds],
  );

  const temporarySelectionsByWeek = useMemo(() => {
    return Object.entries(weekDrafts)
      .map(([week, draft]) => ({ week: Number(week), draft }))
      .filter((entry) => entry.week >= 1)
      .sort((a, b) => a.week - b.week);
  }, [weekDrafts]);

  const existingMatchesForLeague = useMemo(() => {
    if (!dashboard || !builderLeagueId) return [] as MatchRow[];
    return dashboard.matches
      .filter((match) => match.league_id === builderLeagueId)
      .sort((a, b) => a.week_number - b.week_number);
  }, [dashboard, builderLeagueId]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const data = await getAdminDashboard<DashboardData>();
      setDashboard(data);
    } catch (errorObject) {
      showNotice(
        "error",
        errorObject instanceof Error ? errorObject.message : "Unable to load data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBuilderLeague) {
      setWeekDrafts({});
      return;
    }
    setBuilderWeekNumber(1);
    setWeekDrafts({
      1: { played_at: "", slots: createEmptySlots(builderSlotCount), saved: false },
    });
  }, [builderLeagueId, builderSlotCount, selectedBuilderLeague]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function updateCurrentWeekDraft(updater: (draft: WeekDraft) => WeekDraft) {
    setWeekDrafts((prev) => {
      const current =
        prev[builderWeekNumber] ?? {
          played_at: "",
          slots: createEmptySlots(builderSlotCount),
          saved: false,
        };
      return { ...prev, [builderWeekNumber]: updater(current) };
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
        showNotice("error", "A player can only be used once per week.");
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

    showNotice("error", "No empty slot is available for this player.");
  }

  function saveWeekTemporarily() {
    if (!builderLeagueId) {
      showNotice("error", "Please select a league.");
      return;
    }
    if (
      !Number.isInteger(builderWeekNumber) ||
      builderWeekNumber < 1 ||
      builderWeekNumber > builderMaxWeek
    ) {
      showNotice("error", "Please select a valid week before saving.");
      return;
    }
    if (!currentWeekDraft.played_at) {
      showNotice("error", "Please select a date before saving temporarily.");
      return;
    }

    const completedMatches = currentWeekDraft.slots.filter(
      (slot) => slot.player1_id && slot.player2_id,
    );
    if (completedMatches.length === 0) {
      showNotice("error", `Please assign players in week ${builderWeekNumber}.`);
      return;
    }
    const hasIncomplete = currentWeekDraft.slots.some(
      (slot) => Boolean(slot.player1_id) !== Boolean(slot.player2_id),
    );
    if (hasIncomplete) {
      showNotice("error", "Each started slot must have both players assigned.");
      return;
    }

    updateCurrentWeekDraft((draft) => ({ ...draft, saved: true }));
    showNotice("success", `Week ${builderWeekNumber} saved temporarily.`);
  }

  async function saveAllWeeksToDatabase() {
    if (!builderLeagueId || !selectedBuilderLeague) {
      showNotice("error", "Please select a league.");
      return;
    }
    const requiredWeeks = Array.from(
      { length: selectedBuilderLeague.first_round_weeks },
      (_, index) => index + 1,
    );
    for (const week of requiredWeeks) {
      const draft = weekDrafts[week];
      if (!draft || !draft.saved) {
        showNotice("error", `Week ${week} is not saved temporarily yet.`);
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
    try {
      const payload = await createAdminMatches({ league_id: builderLeagueId, weeks: weeksPayload });
      showNotice(
        "success",
        payload.message ?? "All week matches saved successfully.",
      );
      await loadDashboard();
      setBuilderWeekNumber(1);
      setWeekDrafts({
        1: { played_at: "", slots: createEmptySlots(builderSlotCount), saved: false },
      });
    } catch (errorObject) {
      showNotice(
        "error",
        errorObject instanceof Error ? errorObject.message : "Failed to save matches.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !dashboard) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading match planner...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
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
          <h1 className="text-2xl font-semibold">Match Planner</h1>
        </div>
        <Link
          href="/admin"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Dashboard
        </Link>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Define League Matches</h2>
        <div className="mt-3 space-y-3">
          <select
            value={builderLeagueId}
            onChange={(event) => setBuilderLeagueId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select league</option>
            {dashboard.leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>

          {selectedBuilderLeague ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={builderWeekNumber}
                  onChange={(event) => setBuilderWeekNumber(Number(event.target.value))}
                  className="min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {Array.from({ length: builderMaxWeek }, (_, index) => {
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
                  {availablePlayersForBuilder.map((player) => (
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
                    leaguePlayersForBuilder.find((player) => player.id === slot.player1_id)
                      ?.name ?? "";
                  const player2Name =
                    leaguePlayersForBuilder.find((player) => player.id === slot.player2_id)
                      ?.name ?? "";

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
                            if (!draggingPlayerId) return;
                            if (slot.player2_id === draggingPlayerId) return;
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
                            if (!draggingPlayerId) return;
                            if (slot.player1_id === draggingPlayerId) return;
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
            </>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveWeekTemporarily()}
              disabled={busy}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save Week Temporarily
            </button>
            <button
              type="button"
              onClick={() => void saveAllWeeksToDatabase()}
              disabled={busy}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner />
                  Saving...
                </span>
              ) : (
                "Save All Weeks to DB"
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Temporary Week Selections</h3>
        {temporarySelectionsByWeek.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No temporary selections yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {temporarySelectionsByWeek.map(({ week, draft }) => {
              const weekMatches = draft.slots
                .filter((slot) => slot.player1_id && slot.player2_id)
                .map((slot) => {
                  const p1 =
                    leaguePlayersForBuilder.find((player) => player.id === slot.player1_id)
                      ?.name ?? "Unknown";
                  const p2 =
                    leaguePlayersForBuilder.find((player) => player.id === slot.player2_id)
                      ?.name ?? "Unknown";
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
                    <p className="mt-1 text-zinc-600 dark:text-zinc-300">No complete matches yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Saved Matches In DB</h3>
        {existingMatchesForLeague.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No saved matches for selected league yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {existingMatchesForLeague.map((match) => (
              <li key={match.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                Week {match.week_number}: {match.player1_name} vs {match.player2_name} |{" "}
                {formatDate(match.played_at)} | {match.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
