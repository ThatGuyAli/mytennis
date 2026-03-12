"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { APP_COLORS } from "@/lib/theme-colors";

type NoticeType = "success" | "error";

function noticeClassName(type: NoticeType) {
  if (type === "success") {
    return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
  }
  return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
}

export function LoginForm() {
  const router = useRouter();
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = (formData.get("username") as string | null)?.trim() ?? "";
    const password = (formData.get("password") as string | null) ?? "";

    try {
      await loginAdmin(username, password);

      setNotice({ type: "success", message: "Login successful. Redirecting..." });
      router.push("/admin");
      router.refresh();
    } catch (errorObject) {
      setNotice({
        type: "error",
        message: errorObject instanceof Error ? errorObject.message : "Unable to login.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-md ${noticeClassName(notice.type)}`}
          >
            <div className="flex items-center gap-3">
              <span>{notice.message}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded px-1 text-xs opacity-70 hover:opacity-100"
              >
                x
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 outline-none ring-0 transition focus:ring-2 focus:ring-blue-200"
            style={{ borderColor: APP_COLORS.login.panelBorder }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 outline-none ring-0 transition focus:ring-2 focus:ring-blue-200"
            style={{ borderColor: APP_COLORS.login.panelBorder }}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: APP_COLORS.brand.primary, color: APP_COLORS.login.ctaText }}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner />
              Logging in...
            </span>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </>
  );
}
