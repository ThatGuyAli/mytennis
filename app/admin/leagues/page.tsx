import { requireSession } from "@/lib/auth";

import { LeagueSelectorClient } from "./components/league-selector-client";

export default async function LeaguesPage() {
  await requireSession();

  return <LeagueSelectorClient />;
}
