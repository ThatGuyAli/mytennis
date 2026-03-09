import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

import { LoginForm } from "./components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin Login</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Sign in to manage leagues, players, matches, and results.
      </p>
      <LoginForm />
    </main>
  );
}
