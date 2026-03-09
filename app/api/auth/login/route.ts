import { NextResponse } from "next/server";

import {
  authenticateAdmin,
  encodeSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import type { LoginInput } from "@/types";

export async function POST(request: Request) {
  let body: LoginInput | null = null;

  try {
    body = (await request.json()) as LoginInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = body?.username ?? "";
  const password = body?.password ?? "";
  const session = await authenticateAdmin(username, password);

  if (!session) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    data: {
      username: session.username,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, encodeSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
