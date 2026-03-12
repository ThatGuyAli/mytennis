import { getSession } from "@/lib/auth";
import { APP_COLORS } from "@/lib/theme-colors";
import Link from "next/link";

import { StandingsClient } from "./components/standings-client";

export default async function Home() {
  const session = await getSession();

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

      <header className="relative mx-auto flex max-w-6xl items-center justify-between py-6">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em]"
          style={{ color: APP_COLORS.login.title }}
        >
          MyTennis
        </Link>
        <Link
          href={session ? "/admin" : "/login"}
          className="rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition hover:brightness-110"
          style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
        >
          {session ? "Admin Dashboard" : "Admin Login"}
        </Link>
      </header>

      <StandingsClient />
    </main>
  );
}
