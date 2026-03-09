"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAdminLeagues } from "@/lib/api";

type LeagueRow = {
  id: string;
  name: string;
};

type NoticeType = "error";
type Notice = {
  type: NoticeType;
  message: string;
} | null;

function noticeClassName(type: NoticeType) {
  if (type === "error") {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
}

export function LeagueSelectorClient() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeagues() {
      setLoading(true);
      setNotice(null);
      try {
        const data = await getAdminLeagues<{ leagues: LeagueRow[] }>();
        if (!isMounted) return;
        setLeagues(data.leagues);
      } catch (errorObject) {
        if (!isMounted) return;
        setNotice({
          type: "error",
          message:
            errorObject instanceof Error ? errorObject.message : "Failed to load leagues.",
        });
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    void loadLeagues();
    return () => {
      isMounted = false;
    };
  }, []);

  function onViewDetails() {
    const selectedLeague = leagues.find((league) => league.id === selectedLeagueId);
    if (!selectedLeague) {
      setNotice({ type: "error", message: "Please select a league." });
      return;
    }
    const leaguePath = encodeURIComponent(selectedLeague.name);
    router.push(`/admin/leagues/${leaguePath}?id=${selectedLeague.id}`);
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

      <header className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">League Details</h1>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/leagues/create"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Create League
          </Link>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Select League</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Choose a league and open its details page.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedLeagueId}
            onChange={(event) => setSelectedLeagueId(event.target.value)}
            disabled={loading}
            className="min-w-[240px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select the league</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onViewDetails}
            disabled={loading}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View League Details
          </button>
        </div>
      </section>
    </main>
  );
}
