import { readAndOptimizeFileAsDataUrl } from './imageCompression';

export interface PendingAnnouncementFile {
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
}

export const ANNOUNCEMENT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.rtf,.zip,.png,.jpg,.jpeg,.webp,.gif';

export const MAX_ANNOUNCEMENT_FILE_BYTES = 3 * 1024 * 1024; // 3 MB raw limit (Vercel-safe)

const BLOCKED_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.php', '.py', '.rb', '.pl', '.jar',
  '.msi', '.vbs', '.scr', '.dll', '.app', '.com', '.pif'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.txt', '.csv', '.rtf', '.zip',
  '.png', '.jpg', '.jpeg', '.webp', '.gif'
]);

export function formatAttachmentSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const b64 = dataUrl.slice(commaIdx + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export async function processAnnouncementAttachmentFile(file: File): Promise<PendingAnnouncementFile> {
  const name = file.name || 'attachment';
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx !== -1 ? name.slice(dotIdx).toLowerCase() : '';

  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`File type "${ext}" is not allowed for security reasons.`);
  }
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported format "${ext}". Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, RTF, ZIP, PNG, JPG, WEBP, GIF.`
    );
  }

  const isOptimizableImage =
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/webp';

  // Allow slightly larger raw raster images since they get compressed client-side first
  const preLimit = isOptimizableImage ? 8 * 1024 * 1024 : MAX_ANNOUNCEMENT_FILE_BYTES;
  if (file.size > preLimit) {
    throw new Error(
      `File size (${formatAttachmentSize(file.size)}) exceeds the ${formatAttachmentSize(MAX_ANNOUNCEMENT_FILE_BYTES)} limit.`
    );
  }
  if (file.size === 0) {
    throw new Error('The selected file is empty.');
  }

  const dataUrl = await readAndOptimizeFileAsDataUrl(file, {
    maxDimension: 1800,
    maxTargetBytes: 1.5 * 1024 * 1024,
    quality: 0.84
  });

  const finalBytes = estimateDataUrlBytes(dataUrl);
  if (finalBytes > MAX_ANNOUNCEMENT_FILE_BYTES) {
    throw new Error(
      `Processed attachment (${formatAttachmentSize(finalBytes)}) still exceeds the 3 MB upload limit.`
    );
  }

  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const resolvedMime = (mimeMatch?.[1] || file.type || 'application/octet-stream').toLowerCase();

  return {
    name,
    mimeType: resolvedMime,
    dataUrl,
    size: finalBytes || file.size
  };
}

export async function downloadAnnouncementAttachment(
  url: string,
  token: string,
  filename?: string
): Promise<void> {
  if (!url) return;

  if (url.startsWith('/api/')) {
    const separator = url.includes('?') ? '&' : '?';
    const downloadUrl = `${url}${separator}download=1`;
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include'
    });
    if (!res.ok) {
      let msg = 'Failed to download attachment.';
      try {
        const errJson = await res.json();
        if (errJson?.error) msg = errJson.error;
      } catch {
        // ignore non-JSON error
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'announcement-attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    return;
  }

  // External HTTP(S) URL or data URL fallback
  const link = document.createElement('a');
  link.href = url;
  if (url.startsWith('data:')) {
    link.download = filename || 'announcement-attachment';
  } else {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function fetchAnnouncementImagePreviewUrl(url: string, token: string): Promise<string> {
  if (!url) return '';
  if (!url.startsWith('/api/')) return url;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error('Could not load image preview.');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
