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

// Allowlisted YouTube URL parser. Only https YouTube hosts are accepted,
// and only the video ID is extracted — we always rebuild clean URLs from it.
const YT_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"]);
const YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YT_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password || url.port) return null;

  let id: string | null = null;
  if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/);
    id = m?.[2] ?? null;
  }
  return id && YT_ID_RE.test(id) ? id : null;
}

export function isValidYouTubeUrl(input: string): boolean {
  return parseYouTubeId(input) !== null;
}

export function youtubeEmbedUrl(input: string): string | null {
  const id = parseYouTubeId(input);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function youtubeViewUrl(input: string): string | null {
  const id = parseYouTubeId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Accepts a Drive or YouTube link; returns the canonical URL to save, or null. */
export function normalizeVideoUrl(input: string): string | null {
  return normalizeDriveUrl(input) ?? youtubeViewUrl(input);
}

export function isValidVideoUrl(input: string): boolean {
  return isValidDriveUrl(input) || isValidYouTubeUrl(input);
}

/** Embeddable player URL for a saved video link (Drive preview or YouTube embed). */
export function videoEmbedUrl(input: string): string | null {
  return driveEmbedUrl(input) ?? youtubeEmbedUrl(input);
}

/** External watch page for a saved video link. */
export function videoViewUrl(input: string): string | null {
  return driveViewUrl(input) ?? youtubeViewUrl(input);
}
