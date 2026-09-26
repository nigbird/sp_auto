"use client"

import * as React from "react";
import { Download, Eye, FileText, Image as ImageIcon, Loader2, Paperclip, Upload, X } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadReportEvidence, deleteReportEvidence, type EvidenceMeta } from "@/actions/evidence";
import { EVIDENCE_ACCEPT, EVIDENCE_HELP, EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, formatFileSize, isImageMime } from "@/lib/evidence-files";

const fileUrl = (id: string, download = false) => `/api/evidence/${encodeURIComponent(id)}${download ? '?download=1' : ''}`;

/**
 * Evidence attached to one period report. Editable while the owner is filling
 * the report in; read-only (view/download) for submitted reports and approvers.
 */
export function ReportEvidence({ entryId, files: initialFiles, editable = false }: { entryId: string; files: EvidenceMeta[]; editable?: boolean }) {
  const [files, setFiles] = React.useState(initialFiles);
  const [isUploading, setIsUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<EvidenceMeta | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  React.useEffect(() => setFiles(initialFiles), [initialFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Quick checks here save a slow upload; the server checks everything again.
    if (file.size > EVIDENCE_MAX_BYTES) {
      toast({ title: "File too large", description: `"${file.name}" is ${formatFileSize(file.size)}. The limit is 5 MB.`, variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadReportEvidence(entryId, formData);
      if (!result.success) {
        toast({ title: "Couldn't attach the file", description: result.message, variant: "destructive" });
        return;
      }
      if (result.evidence) setFiles(prev => [...prev, result.evidence!]);
    } catch {
      toast({ title: "Couldn't attach the file", description: "The upload failed. Check the file size and try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (file: EvidenceMeta) => {
    setRemovingId(file.id);
    try {
      const result = await deleteReportEvidence(file.id);
      if (!result.success) {
        toast({ title: "Couldn't remove the file", description: result.message, variant: "destructive" });
        return;
      }
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } finally {
      setRemovingId(null);
    }
  };

  if (!editable && files.length === 0) return null;
  const canAddMore = files.length < EVIDENCE_MAX_FILES;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Paperclip className="h-4 w-4" /> Supporting evidence {files.length > 0 && `(${files.length})`}</p>
        {editable && (
          <>
            <input ref={inputRef} type="file" accept={EVIDENCE_ACCEPT} onChange={handleUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" disabled={isUploading || !canAddMore} onClick={() => inputRef.current?.click()}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {canAddMore ? 'Attach file' : `Limit of ${EVIDENCE_MAX_FILES} reached`}
            </Button>
          </>
        )}
      </div>
      {editable && <p className="text-xs text-muted-foreground">{EVIDENCE_HELP}</p>}

      {files.length > 0 && (
        <ul className="divide-y rounded-md border">
          {files.map(file => {
            const image = isImageMime(file.mimeType);
            return (
              <li key={file.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {image ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate" title={file.fileName}>{file.fileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {image && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(file)}>
                      <Eye className="mr-1 h-4 w-4" /> View
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <a href={fileUrl(file.id, true)} rel="noopener noreferrer"><Download className="mr-1 h-4 w-4" /> Download</a>
                  </Button>
                  {editable && (
                    <Button type="button" variant="ghost" size="icon" disabled={removingId === file.id} onClick={() => handleRemove(file)} aria-label={`Remove ${file.fileName}`}>
                      {removingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 text-destructive" />}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.fileName}</DialogTitle>
          </DialogHeader>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- a private, authenticated file; next/image would proxy and cache it.
            <img src={fileUrl(preview.id)} alt={preview.fileName} className="mx-auto max-h-[75vh] w-auto rounded-md object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
