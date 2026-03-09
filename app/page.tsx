import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.18),transparent_40%)]" />

      <section className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:py-24">
        <header className="flex items-center justify-between">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            MyTennis
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/standings"
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
            >
              Standings
            </Link>
            <Link
              href={session ? "/admin" : "/login"}
              className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
            >
              {session ? "Admin Dashboard" : "Admin Login"}
            </Link>
          </div>
        </header>

        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            Tennis League Management Platform
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Organize leagues, schedule matches, and track performance with clarity.
          </h1>
          <p className="max-w-2xl text-zinc-300 md:text-lg">
            MyTennis helps admins manage leagues end-to-end: players, weekly match planning,
            result entry, and live standings in one clean workflow.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/standings"
              className="rounded-md bg-white px-5 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              View Standings
            </Link>
            <Link
              href={session ? "/admin" : "/login"}
              className="rounded-md border border-zinc-600 px-5 py-3 text-sm font-medium hover:bg-zinc-900"
            >
              {session ? "Go to Admin" : "Login as Admin"}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="font-semibold text-emerald-200">League Control</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Create leagues with custom rule types and scoring systems.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="font-semibold text-sky-200">Match Workflow</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Plan weekly matches, edit schedules, and submit results inline.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="font-semibold text-violet-200">Standings Insights</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Explore rankings with sortable statistics and collapsible table views.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
