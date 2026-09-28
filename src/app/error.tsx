"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="flex w-full max-w-md flex-col items-center rounded-3xl border-border/50 p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(16,24,40,0.10)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An unexpected error interrupted this page. Your data is safe — try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="h-4 w-4" /> Go to dashboard
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
