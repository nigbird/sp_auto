
import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { SessionKeepAlive } from "./session-keepalive";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <SessionKeepAlive />
      <div className="flex h-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className={cn(
            "flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8"
          )}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
