import * as path from "path";

export const MAX_ARCHIVE_ENTRIES = 50_000;
export const MAX_ARCHIVE_ENTRY_BYTES = 500 * 1024 * 1024;
export const DEFAULT_MAX_ARCHIVE_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_DATA_JSON_BYTES = 200 * 1024 * 1024;

export interface ArchiveEntryInfo {
  entryName: string;
  isDirectory: boolean;
  /** Uncompressed size from the ZIP header (attacker-controlled, but adm-zip verifies it on extraction). */
  size: number;
}

export function resolveMaxArchiveTotalBytes(envValue: string | undefined): number {
  const parsed = Number.parseInt(envValue ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ARCHIVE_TOTAL_BYTES;
}

/** Rejects zip bombs before anything is decompressed. Throws a German error message. */
export function assertArchiveWithinLimits(
  entries: ArchiveEntryInfo[],
  maxTotalBytes: number = DEFAULT_MAX_ARCHIVE_TOTAL_BYTES,
): void {
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("Archiv enthält zu viele Einträge");
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new Error("Archiv enthält eine zu große Datei");
    }
    total += entry.size;
    if (total > maxTotalBytes) {
      throw new Error("Archiv ist entpackt zu groß");
    }
  }
}

/** Returns the resolved path only if it stays strictly inside baseDir, otherwise null. */
export function resolveInsideDir(baseDir: string, relativePath: string): string | null {
  const base = path.resolve(baseDir);
  const full = path.resolve(base, relativePath);
  return full.startsWith(base + path.sep) ? full : null;
}
