// Allowlisted Google Drive URL parser. Only https Drive/Docs hosts are accepted,
// and only the file ID is extracted — we always rebuild clean URLs from it.
const ALLOWED_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function parseDriveFileId(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password || url.port) return null;

  const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
  const id = fileMatch?.[1] ?? (url.pathname === "/open" || url.pathname === "/uc" ? url.searchParams.get("id") : null);
  return id && ID_RE.test(id) ? id : null;
}

export function isValidDriveUrl(input: string): boolean {
  return parseDriveFileId(input) !== null;
}

export function driveEmbedUrl(input: string): string | null {
  const id = parseDriveFileId(input);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

export function driveViewUrl(input: string): string | null {
  const id = parseDriveFileId(input);
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

/** Normalizes to the canonical view URL before saving. */
export function normalizeDriveUrl(input: string): string | null {
  return driveViewUrl(input);
}
