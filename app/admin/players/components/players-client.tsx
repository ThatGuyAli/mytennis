"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  createAdminPlayer,
  deleteAdminPlayer,
  getAdminLeagues,
  getAdminPlayersAll,
  getAdminPlayersByLeague,
} from "@/lib/api";
import { APP_COLORS } from "@/lib/theme-colors";

type LeagueRow = {
  id: string;
  name: string;
};

type PlayerRow = {
  id: string;
  name: string;
  created_at?: string;
};

type NoticeType = "success" | "error";
type Notice = {
  type: NoticeType;
  message: string;
} | null;

function noticeClassName(type: NoticeType) {
  if (type === "success") {
    return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
  }
  return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

const PANEL_CLASS = "rounded-2xl border p-4 shadow-xl";
const PANEL_STYLE = {
  backgroundColor: APP_COLORS.login.panelBackground,
  borderColor: APP_COLORS.login.panelBorder,
  boxShadow: `0 24px 56px ${APP_COLORS.login.panelShadow}`,
} as const;

export function PlayersClient() {
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [leaguePlayers, setLeaguePlayers] = useState<PlayerRow[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string>("");
  const [pendingDeletePlayer, setPendingDeletePlayer] = useState<PlayerRow | null>(null);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [nameFilter, setNameFilter] = useState("");

  const currentLeagueName = useMemo(
    () => leagues.find((item) => item.id === selectedLeagueId)?.name ?? "",
    [leagues, selectedLeagueId],
  );

  async function loadLeagues() {
    const data = await getAdminLeagues<{ leagues: LeagueRow[] }>();
    setLeagues(data.leagues);
  }

  const filteredPlayers = useMemo(() => {
    const normalizedFilter = nameFilter.trim().toLowerCase();
    if (!normalizedFilter) return allPlayers;
    return allPlayers.filter((player) => player.name.toLowerCase().includes(normalizedFilter));
  }, [allPlayers, nameFilter]);

  async function loadAllPlayers() {
    const data = await getAdminPlayersAll<{ players: PlayerRow[] }>();
    setAllPlayers(data.players);
  }

  async function loadLeaguePlayers(leagueId: string) {
    if (!leagueId) {
      setLeaguePlayers([]);
      return;
    }

    const data = await getAdminPlayersByLeague<{ players: PlayerRow[] }>(leagueId);
    setLeaguePlayers(data.players);
  }

  async function refresh(leagueId = selectedLeagueId) {
    setLoading(true);
    setNotice(null);
    try {
      await Promise.all([loadLeagues(), loadAllPlayers(), loadLeaguePlayers(leagueId)]);
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to load players.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function deletePlayer(player: PlayerRow) {
    setDeletingPlayerId(player.id);
    setNotice(null);
    try {
      const data = await deleteAdminPlayer(player.id);
      await refresh(selectedLeagueId);
      setNotice({
        type: "success",
        message: data.message ?? `Player "${player.name}" deleted successfully.`,
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to delete player.",
      });
    } finally {
      setDeletingPlayerId("");
      setPendingDeletePlayer(null);
    }
  }

  async function createPlayer(playerName: string, form: HTMLFormElement) {
    setIsCreatingPlayer(true);
    setNotice(null);
    try {
      const data = await createAdminPlayer(playerName);
      form.reset();
      await refresh(selectedLeagueId);
      setNotice({
        type: "success",
        message: data.message ?? "Player created successfully.",
      });
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to create player.",
      });
    } finally {
      setIsCreatingPlayer(false);
    }
  }

  useEffect(() => {
    void refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function onLeagueChange(nextLeagueId: string) {
    setSelectedLeagueId(nextLeagueId);
    try {
      await loadLeaguePlayers(nextLeagueId);
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load league players.",
      });
    }
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
      <ConfirmModal
        isOpen={Boolean(pendingDeletePlayer)}
        title="Confirm Deletion"
        description={
          pendingDeletePlayer
            ? `Are you sure you want to delete "${pendingDeletePlayer.name}"? This will remove the player and league assignments.`
            : ""
        }
        confirmLabel="Delete Player"
        cancelLabel="Cancel"
        isConfirming={Boolean(deletingPlayerId)}
        onCancel={() => setPendingDeletePlayer(null)}
        onConfirm={() => {
          if (pendingDeletePlayer) {
            void deletePlayer(pendingDeletePlayer);
          }
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
          <h1 className="text-2xl font-semibold" style={{ color: APP_COLORS.login.title }}>
            Players Management
          </h1>
        </div>
        <Link
          href="/admin"
          className="rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
          style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
        >
          Dashboard
        </Link>
      </header>

      <section className={PANEL_CLASS} style={PANEL_STYLE}>
        <h2 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
          Create Player
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const playerName = (formData.get("name") as string | null)?.trim() ?? "";
            if (!playerName) {
              setNotice({ type: "error", message: "Player name is required." });
              return;
            }
            void createPlayer(playerName, form);
          }}
          className="mt-3 flex flex-wrap items-center justify-between sm:justify-start gap-2"
        >
          <input
            name="name"
            placeholder="Player full name"
            required
            className="min-w-[200px] sm:min-w-[240px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={isCreatingPlayer}
            className="rounded-lg px-4 py-2 text-sm font-semibold shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
          >
            {isCreatingPlayer ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner />
                Saving...
              </span>
            ) : (
              "Save Player"
            )}
          </button>
        </form>
      </section>

      <section className={PANEL_CLASS} style={PANEL_STYLE}>
        <h2 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
          Players by League
        </h2>
        <div className="mt-3 max-w-md">
          <select
            value={selectedLeagueId}
            onChange={(event) => void onLeagueChange(event.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select league</option>
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
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300" colSpan={2}>
                    Loading...
                  </td>
                </tr>
              ) : leaguePlayers.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300" colSpan={2}>
                    {selectedLeagueId
                      ? `No players found in ${currentLeagueName || "this league"}.`
                      : "Select a league to view players."}
                  </td>
                </tr>
              ) : (
                leaguePlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">{player.name}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingDeletePlayer(player)}
                        disabled={deletingPlayerId === player.id}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                      >
                        {deletingPlayerId === player.id ? (
                          <span className="inline-flex items-center gap-2">
                            <LoadingSpinner />
                            Deleting...
                          </span>
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={PANEL_CLASS} style={PANEL_STYLE}>
        <h2 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
          All Players
        </h2>
        <div className="mt-3 max-w-sm">
          <input
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Filter by player name"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300" colSpan={3}>
                    Loading...
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300" colSpan={3}>
                    No players found for this filter.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">{player.name}</td>
                    <td className="px-3 py-2">{formatDate(player.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingDeletePlayer(player)}
                        disabled={deletingPlayerId === player.id}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                      >
                        {deletingPlayerId === player.id ? (
                          <span className="inline-flex items-center gap-2">
                            <LoadingSpinner />
                            Deleting...
                          </span>
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </section>
    </main>
  );
}
