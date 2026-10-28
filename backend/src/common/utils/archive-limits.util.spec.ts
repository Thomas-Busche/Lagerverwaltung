import * as path from "path";

import {
  assertArchiveWithinLimits,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_ENTRY_BYTES,
  resolveInsideDir,
  resolveMaxArchiveTotalBytes,
} from "./archive-limits.util";

const file = (size: number) => ({ entryName: "a.bin", isDirectory: false, size });

describe("assertArchiveWithinLimits", () => {
  it("accepts small archives", () => {
    expect(() => assertArchiveWithinLimits([file(10), file(20)])).not.toThrow();
  });
  it("rejects oversized single entries", () => {
    expect(() => assertArchiveWithinLimits([file(MAX_ARCHIVE_ENTRY_BYTES + 1)])).toThrow();
  });
  it("rejects when total exceeds the limit", () => {
    expect(() => assertArchiveWithinLimits([file(60), file(60)], 100)).toThrow();
  });
  it("rejects too many entries", () => {
    const entries = Array.from({ length: MAX_ARCHIVE_ENTRIES + 1 }, () => file(1));
    expect(() => assertArchiveWithinLimits(entries)).toThrow();
  });
});

describe("resolveMaxArchiveTotalBytes", () => {
  it("falls back to default for invalid values", () => {
    expect(resolveMaxArchiveTotalBytes("abc")).toBe(2 * 1024 * 1024 * 1024);
    expect(resolveMaxArchiveTotalBytes("1000")).toBe(1000);
  });
});

describe("resolveInsideDir", () => {
  const base = path.resolve("/app/purchase-orders");
  it("allows nested paths", () => {
    expect(resolveInsideDir(base, "2026/a.pdf")).toBe(path.join(base, "2026", "a.pdf"));
  });
  it("rejects traversal and sibling-prefix paths", () => {
    expect(resolveInsideDir(base, "../etc/passwd")).toBeNull();
    expect(resolveInsideDir(base, "../purchase-orders-evil/a.pdf")).toBeNull();
    expect(resolveInsideDir(base, "")).toBeNull();
  });
});
