import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <SidebarInset>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
