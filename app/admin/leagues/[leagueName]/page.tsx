import { requireSession } from "@/lib/auth";

import { LeagueWorkflowClient } from "./components/league-workflow-client";

export default async function LeagueWorkflowPage() {
  await requireSession();

  return <LeagueWorkflowClient />;
}
