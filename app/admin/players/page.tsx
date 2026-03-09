import { requireSession } from "@/lib/auth";

import { PlayersClient } from "./components/players-client";

export default async function AdminPlayersPage() {
  await requireSession();

  return <PlayersClient />;
}
