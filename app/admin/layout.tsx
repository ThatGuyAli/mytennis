import type { ReactNode } from "react";

import { requireSession } from "@/lib/auth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireSession();

  return <>{children}</>;
}
