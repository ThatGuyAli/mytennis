"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminPlayer } from "@/lib/api";

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

export function CreatePlayerClient() {
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
      const payload = await createAdminPlayer((formData.get("name") as string | null) ?? "");

      form.reset();
      setNotice({
        type: "success",
        message: payload.message ?? "Player created successfully.",
      });
      router.push("/admin/players");
      router.refresh();
    } catch (errorObject) {
      setNotice({
        type: "error",
        message:
          errorObject instanceof Error ? errorObject.message : "Failed to create player.",
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

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Create Player</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/players"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Players
          </Link>
        </div>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Add New Player</h2>
        <form onSubmit={(event) => void onSubmit(event)} className="mt-3 flex flex-wrap gap-2">
          <input
            name="name"
            placeholder="Player full name"
            required
            className="min-w-[200px] sm:min-w-[240px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSubmitting ? "Saving..." : "Save Player"}
          </button>
        </form>
      </section>
    </main>
  );
}
