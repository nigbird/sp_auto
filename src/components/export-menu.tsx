"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export interface ExportOption {
  label: string;
  description?: string;
  kind: "excel" | "pdf";
  /** Runs in the browser; may be async. */
  onSelect?: () => void | Promise<void>;
  /** Or a server download URL. */
  href?: string;
  disabled?: boolean;
}

/** An "Export" button with a menu of Excel/PDF downloads; failures show a toast instead of failing silently. */
export function ExportMenu({ options, label = "Export", size = "sm" }: { options: ExportOption[]; label?: string; size?: "sm" | "default" }) {
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const run = async (option: ExportOption) => {
    if (option.href) {
      window.location.href = option.href;
      return;
    }
    if (!option.onSelect) return;
    setBusy(true);
    try {
      await option.onSelect();
    } catch (error) {
      console.error("Export failed", error);
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "The file couldn't be created. Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(option => (
          <DropdownMenuItem key={option.label} disabled={option.disabled} onSelect={() => run(option)} className="items-start gap-2">
            {option.kind === "excel" ? <FileSpreadsheet className="mt-0.5 h-4 w-4 text-green-600" /> : <FileText className="mt-0.5 h-4 w-4 text-red-600" />}
            <div>
              <div className="font-medium">{option.label}</div>
              {option.description && <div className="text-xs text-muted-foreground">{option.description}</div>}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
