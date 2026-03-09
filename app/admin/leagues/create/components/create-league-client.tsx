"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminLeague } from "@/lib/api";

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

export function CreateLeagueClient() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const payload = await createAdminLeague({
        name: (formData.get("name") as string | null) ?? "",
        rule_type: (formData.get("rule_type") as string | null) ?? "",
        number_of_players: Number((formData.get("number_of_players") as string | null) ?? "0"),
        first_round_weeks: Number((formData.get("first_round_weeks") as string | null) ?? "0"),
      });

      form.reset();
      const createdLeague = payload.league;
      if (!createdLeague?.id || !createdLeague.name) {
        throw new Error("League created but redirect information is missing.");
      }
      setNotice({ type: "success", message: "League created successfully." });
      const leaguePath = encodeURIComponent(createdLeague.name);
      router.push(`/admin/leagues/${leaguePath}?id=${createdLeague.id}`);
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to create league.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <div>
          <h1 className="text-2xl font-semibold">Create League</h1>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/leagues"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Leagues
          </Link>
        </div>
      </header>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Create League</h3>
        <input
          name="name"
          placeholder="League name"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="rule_type"
          required
          defaultValue="three_sets"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="three_sets">Three Sets</option>
          <option value="two_sets_tiebreak">Two Sets + Tiebreak</option>
        </select>
        <input
          name="number_of_players"
          type="number"
          min={2}
          step={1}
          required
          placeholder="Number of players"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="first_round_weeks"
          type="number"
          min={1}
          step={1}
          required
          placeholder="First round weeks"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isSubmitting ? "Saving..." : "Save League"}
        </button>
      </form>
    </main>
  );
}
