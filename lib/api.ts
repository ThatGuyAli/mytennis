type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? payload?.message ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  if (typeof payload?.data === "undefined") {
    throw new ApiError("Response data is missing.", response.status);
  }

  return payload.data;
}

function jsonRequestInit(method: "POST" | "PATCH" | "DELETE", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function loginAdmin(username: string, password: string) {
  return requestData<{ username: string }>(
    "/api/auth/login",
    jsonRequestInit("POST", { username, password }),
  );
}

export function logoutAdmin() {
  return requestData<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
}

export function getAdminDashboard<T>() {
  return requestData<T>("/api/admin/dashboard", { method: "GET", cache: "no-store" });
}

export function getAdminLeagues<T>() {
  return requestData<T>("/api/admin/leagues", { method: "GET", cache: "no-store" });
}

export function getAdminLeagueDetails<T>(leagueId: string) {
  return requestData<T>(`/api/admin/leagues/details?league_id=${leagueId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export function createAdminLeague(
  body: {
    name: string;
    rule_type: string;
    scoring_rule_type: number;
    number_of_players: number;
    first_round_weeks: number;
  },
) {
  return requestData<{ created: boolean; league?: { id: string; name: string }; message?: string }>(
    "/api/admin/leagues",
    jsonRequestInit("POST", body),
  );
}

export function updateAdminLeague(
  body: {
    league_id: string;
    name?: string;
    rule_type?: string;
    scoring_rule_type?: number;
    active?: number;
    number_of_players?: number;
    first_round_weeks?: number;
  },
) {
  return requestData<{ updated: boolean; message?: string }>(
    "/api/admin/leagues",
    jsonRequestInit("PATCH", body),
  );
}

export function getAdminPlayersByLeague<T>(leagueId: string) {
  return requestData<T>(`/api/admin/players?league_id=${leagueId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export function getAdminPlayersAll<T>() {
  return requestData<T>("/api/admin/players", {
    method: "GET",
    cache: "no-store",
  });
}

export function getAdminPlayersPaged<T>(page: number, pageSize: number) {
  return requestData<T>(`/api/admin/players?page=${page}&page_size=${pageSize}`, {
    method: "GET",
    cache: "no-store",
  });
}

export function createAdminPlayer(name: string) {
  return requestData<{ created: boolean; message?: string; player?: { id: string; name: string } }>(
    "/api/admin/players",
    jsonRequestInit("POST", { name }),
  );
}

export function deleteAdminPlayer(playerId: string) {
  return requestData<{ deleted: boolean; message?: string }>(
    "/api/admin/players",
    jsonRequestInit("DELETE", { player_id: playerId }),
  );
}

export function attachPlayerToLeague(leagueId: string, playerId: string) {
  return requestData<{ attached: boolean; message?: string }>(
    "/api/admin/league-players",
    jsonRequestInit("POST", { league_id: leagueId, player_id: playerId }),
  );
}

export function removePlayerFromLeague(leagueId: string, playerId: string) {
  return requestData<{ removed: boolean; message?: string }>(
    "/api/admin/league-players",
    jsonRequestInit("DELETE", { league_id: leagueId, player_id: playerId }),
  );
}

export function createAdminMatches(
  body: {
    league_id: string;
    weeks?: Array<{
      week_number: number;
      played_at: string;
      matches: Array<{ player1_id: string; player2_id: string }>;
    }>;
    week_number?: number;
    played_at?: string;
    matches?: Array<{ player1_id: string; player2_id: string }>;
  },
) {
  return requestData<{ created: boolean; count?: number; message?: string }>(
    "/api/admin/matches",
    jsonRequestInit("POST", body),
  );
}

export function updateAdminMatches(
  body: {
    league_id?: string;
    week_number?: number;
    played_at?: string;
    match_id?: string;
    matches?: Array<{ player1_id: string; player2_id: string }>;
  },
) {
  return requestData<{ updated: boolean; count?: number; message?: string }>(
    "/api/admin/matches",
    jsonRequestInit("PATCH", body),
  );
}

export function upsertAdminSet(
  body: {
    match_id: string;
    set_number: number;
    player1_games: number;
    player2_games: number;
    is_tiebreak: boolean;
  },
) {
  return requestData<{ upserted: boolean }>(
    "/api/admin/sets",
    jsonRequestInit("POST", body),
  );
}
