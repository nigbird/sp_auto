/**
 * Rules for report evidence uploads. Client-safe (no server imports): the
 * limits and `accept` list are shown in the upload UI, while
 * detectEvidenceType() is what the server trusts — the file's real type comes
 * from its first bytes, never from the browser-supplied MIME type or name alone.
 */

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const EVIDENCE_MAX_FILES = 5; // per report
export const EVIDENCE_MAX_NAME_LENGTH = 120;

type EvidenceType = { mimeType: string; isImage: boolean };

const IMAGE_TYPES: Record<string, EvidenceType> = {
  png: { mimeType: 'image/png', isImage: true },
  jpeg: { mimeType: 'image/jpeg', isImage: true },
  gif: { mimeType: 'image/gif', isImage: true },
  webp: { mimeType: 'image/webp', isImage: true },
};

/** Office Open XML files are zip archives; the extension says which kind. */
const ZIP_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Legacy Office files share the OLE compound-file header. */
const OLE_TYPES: Record<string, string> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};

const TEXT_TYPES: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

/** For the file picker's `accept` attribute. SVG and HTML are deliberately absent: they can carry script. */
export const EVIDENCE_ACCEPT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', ...Object.keys(ZIP_TYPES), ...Object.keys(OLE_TYPES), ...Object.keys(TEXT_TYPES)].map(e => e.startsWith('.') ? e : `.${e}`).join(',');

export const EVIDENCE_HELP = 'Images (PNG, JPG, GIF, WebP), PDF, Word, Excel, PowerPoint, CSV or text — up to 5 MB each, 5 files per report.';

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => Array.from(s, c => c.charCodeAt(0));

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The file's real type from its content, or null if it isn't an allowed kind of file. */
export function detectEvidenceType(bytes: Uint8Array, fileName: string): EvidenceType | null {
  const ext = extensionOf(fileName);

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return IMAGE_TYPES.png;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return IMAGE_TYPES.jpeg;
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return IMAGE_TYPES.gif;
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return IMAGE_TYPES.webp;
  if (startsWith(bytes, ascii('%PDF-'))) return { mimeType: 'application/pdf', isImage: false };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && ZIP_TYPES[ext]) return { mimeType: ZIP_TYPES[ext], isImage: false };
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && OLE_TYPES[ext]) return { mimeType: OLE_TYPES[ext], isImage: false };

  if (TEXT_TYPES[ext]) {
    // Plain text has no signature: accept it only if it's valid UTF-8 with no binary (NUL) bytes.
    if (bytes.includes(0)) return null;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
    return { mimeType: TEXT_TYPES[ext], isImage: false };
  }
  return null;
}

/** Strips any path, control and quote characters, and caps the length while keeping the extension. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'file';
  if (cleaned.length <= EVIDENCE_MAX_NAME_LENGTH) return cleaned;
  const ext = extensionOf(cleaned);
  const keep = EVIDENCE_MAX_NAME_LENGTH - (ext ? ext.length + 1 : 0);
  return ext ? `${cleaned.slice(0, keep)}.${ext}` : cleaned.slice(0, EVIDENCE_MAX_NAME_LENGTH);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mimeType: string) {
  return Object.values(IMAGE_TYPES).some(t => t.mimeType === mimeType);
}
