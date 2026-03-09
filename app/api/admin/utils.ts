import { NextRequest, NextResponse } from "next/server";

import { decodeSessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth";

export function getApiSession(request: NextRequest): SessionPayload | null {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  return decodeSessionToken(raw);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
