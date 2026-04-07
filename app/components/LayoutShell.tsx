"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./AppSidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0 px-8 py-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
