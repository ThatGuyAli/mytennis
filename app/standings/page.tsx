import { requireSession } from "@/lib/auth";

import { StandingsClient } from "./components/standings-client";

export default async function StandingsPage() {
  await requireSession();

  return <StandingsClient />;
}
