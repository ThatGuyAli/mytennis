"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminLeague } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { APP_COLORS } from "@/lib/theme-colors";

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
        scoring_rule_type: Number((formData.get("scoring_rule_type") as string | null) ?? "1"),
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
            {notice.message}
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: APP_COLORS.login.title }}>
            Create League
          </h1>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Link
            href="/admin"
            className="rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
            style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/leagues"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-white/70"
            style={{ borderColor: APP_COLORS.login.panelBorder, color: APP_COLORS.login.subtitle }}
          >
            Leagues
          </Link>
        </div>
      </header>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-3 rounded-2xl border p-4 shadow-xl"
        style={{
          backgroundColor: APP_COLORS.login.panelBackground,
          borderColor: APP_COLORS.login.panelBorder,
          boxShadow: `0 24px 56px ${APP_COLORS.login.panelShadow}`,
        }}
      >
        <h3 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
          Create League
        </h3>
        <input
          name="name"
          placeholder="League name"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{ borderColor: APP_COLORS.login.panelBorder }}
        />
        <select
          name="rule_type"
          required
          defaultValue="three_sets"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{ borderColor: APP_COLORS.login.panelBorder }}
        >
          <option value="three_sets">Three Sets</option>
          <option value="two_sets_tiebreak">Two Sets + Tiebreak</option>
        </select>
        <select
          name="scoring_rule_type"
          required
          defaultValue="3"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{ borderColor: APP_COLORS.login.panelBorder }}
        >
          <option value="3">Scoring Rule 1 - Standard Three Sets</option>
          <option value="4">Scoring Rule 2 - Standard Two Sets/Tie-break</option>
        </select>
        <input
          name="number_of_players"
          type="number"
          min={2}
          step={1}
          required
          placeholder="Number of players"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{ borderColor: APP_COLORS.login.panelBorder }}
        />
        <input
          name="first_round_weeks"
          type="number"
          min={1}
          step={1}
          required
          placeholder="First round weeks"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{ borderColor: APP_COLORS.login.panelBorder }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg px-4 py-2 text-sm font-semibold shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner />
              Saving...
            </span>
          ) : (
            "Save League"
          )}
        </button>
      </form>
      </section>
    </main>
  );
}
