import { requireSession } from "@/lib/auth";

import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  await requireSession();

  return <AdminClient />;
}
