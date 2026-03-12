import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { APP_COLORS } from "@/lib/theme-colors";

import { LoginForm } from "./components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/admin");
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

      <section className="mx-auto flex min-h-[80vh] w-full max-w-md items-center">
        <div
          className="w-full rounded-2xl border p-6 shadow-2xl sm:p-8"
          style={{
            backgroundColor: APP_COLORS.login.panelBackground,
            borderColor: APP_COLORS.login.panelBorder,
            boxShadow: `0 24px 56px ${APP_COLORS.login.panelShadow}`,
          }}
        >
          <div className="mb-1 inline-flex rounded-full border px-3 py-1 text-xs font-medium text-zinc-700">
            Tennis League Admin
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: APP_COLORS.login.title }}>
            Welcome Back
          </h1>
          <p className="mt-2 text-sm" style={{ color: APP_COLORS.login.subtitle }}>
            Sign in to manage leagues, players, matches, results, and standings in one place.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
