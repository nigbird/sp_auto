
import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStrategicPlanPage = pathname.startsWith('/strategic-plan');
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col">
          <Header />
          <main className={cn(
            "flex-1 bg-background",
            isStrategicPlanPage ? "p-4 sm:p-6" : "p-4 sm:p-6 lg:p-8"
          )}>
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
