import { requireSession } from "@/lib/auth";

import { CreatePlayerClient } from "./components/create-player-client";

export default async function CreatePlayerPage() {
  await requireSession();

  return <CreatePlayerClient />;
}
