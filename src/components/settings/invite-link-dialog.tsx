"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shown when an invitation email couldn't be sent (e.g. SMTP isn't configured),
 * so the administrator can pass the set-password link on themselves.
 */
export function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: { name: string; email: string; link: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays selectable in the field.
    }
  };

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => { if (!open) { setCopied(false); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitation email not sent</DialogTitle>
          <DialogDescription>
            The account for <strong>{invite?.name}</strong> is ready, but the email to {invite?.email} could not be sent.
            Share this link with them directly so they can set their password. It works once and expires in 3 days.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={invite?.link ?? ""} onFocus={(e) => e.currentTarget.select()} aria-label="Set-password link" />
          <Button type="button" variant="outline" onClick={copy} className="shrink-0">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          To email invitations automatically, set SMTP_HOST, SMTP_PORT, SMTP_EMAIL_USER and SMTP_EMAIL_PASS on the server.
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
