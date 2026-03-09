import { requireSession } from "@/lib/auth";

import { MatchesClient } from "./components/matches-client";

export default async function AdminMatchesPage() {
  await requireSession();

  return <MatchesClient />;
}
