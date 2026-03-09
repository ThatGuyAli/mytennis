import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { toTitleCaseWords } from "@/lib/text";

import { badRequestResponse, getApiSession, unauthorizedResponse } from "../utils";

type CreateUserBody = {
  username?: string;
  password?: string;
};

type UpdatePasswordBody = {
  user_id?: string;
  new_password?: string;
};

type DeleteUserBody = {
  user_id?: string;
};

function toText(value: string | undefined) {
  return value?.trim() ?? "";
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function POST(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: CreateUserBody | null = null;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const username = toTitleCaseWords(toText(body?.username));
  const password = body?.password ?? "";

  if (!username) {
    return badRequestResponse("Username is required.");
  }

  if (password.length < 6) {
    return badRequestResponse("Password must be at least 6 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query<{ id: string; username: string }>(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username`,
      [username, passwordHash],
    );

    return NextResponse.json(
      {
        data: {
          created: true,
          user: result.rows[0],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return badRequestResponse("Username already exists.");
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: UpdatePasswordBody | null = null;
  try {
    body = (await request.json()) as UpdatePasswordBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const userId = toText(body?.user_id) || session.userId;
  const newPassword = body?.new_password ?? "";

  if (newPassword.length < 6) {
    return badRequestResponse("New password must be at least 6 characters.");
  }

  const existing = await query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );

  if (!existing.rows[0]) {
    return badRequestResponse("User not found.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `UPDATE users
     SET password_hash = $2,
         updated_at = now()
     WHERE id = $1`,
    [userId, passwordHash],
  );

  return NextResponse.json({ data: { updated: true } });
}

export async function DELETE(request: NextRequest) {
  const session = getApiSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let body: DeleteUserBody | null = null;
  try {
    body = (await request.json()) as DeleteUserBody;
  } catch {
    return badRequestResponse("Invalid request body.");
  }

  const userId = toText(body?.user_id);
  if (!userId) {
    return badRequestResponse("user_id is required.");
  }

  if (userId === session.userId) {
    return badRequestResponse("You cannot delete your own account.");
  }

  const result = await query<{ id: string }>(
    `UPDATE users
     SET deleted_at = now(),
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [userId],
  );

  if (!result.rows[0]) {
    return badRequestResponse("User not found or already deleted.");
  }

  return NextResponse.json({ data: { deleted: true } });
}
