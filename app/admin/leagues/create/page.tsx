import { requireSession } from "@/lib/auth";

import { CreateLeagueClient } from "./components/create-league-client";

export default async function CreateLeaguePage() {
  await requireSession();

  return <CreateLeagueClient />;
}
