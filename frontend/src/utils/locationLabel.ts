import type { LocationDto } from "./api";

type ParentResolver = (id: string) => LocationDto | undefined;

/** "Regal 3 Fach 2" style codes become "Regal 3 / Fach 2"; returns null for anything else. */
export const formatStructuredLocationCode = (code?: string | null): string | null => {
  const raw = code?.trim() ?? "";
  if (!raw) return null;

  const shelfMatch = raw.match(/regal\D*(\d+)\D+fach\D*(\d+)/i);
  if (shelfMatch) {
    return `Regal ${shelfMatch[1]} / Fach ${shelfMatch[2]}`;
  }

  const cabinetMatch = raw.match(/schrank\D*(\d+)\D+schublade\D*(\d+)/i);
  if (cabinetMatch) {
    return `Schrank ${cabinetMatch[1]} / Schublade ${cabinetMatch[2]}`;
  }

  return null;
};

/** Root first. The optional resolver prefers a fully loaded parent over the slim one nested in the child. */
export const getLocationChain = (loc?: LocationDto | null, resolveParent?: ParentResolver): LocationDto[] => {
  if (!loc) return [];

  const chain: LocationDto[] = [];
  const seen = new Set<string>();
  let current: LocationDto | null | undefined = loc;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    const parentId: string | undefined = current.parent?.id;
    current = parentId ? (resolveParent?.(parentId) ?? current.parent) : null;
  }

  return chain.reverse();
};

/** Short label of the place where an article is stored (shelf/bin, not the warehouse). */
export const getLocationLabel = (loc?: LocationDto | null, resolveParent?: ParentResolver): string => {
  if (!loc) return "-";

  const chain = getLocationChain(loc, resolveParent);
  const relevantNodes = chain.filter((entry) => entry.type !== "WAREHOUSE" && entry.type !== "VEHICLE");
  const target = relevantNodes[relevantNodes.length - 1] ?? chain[chain.length - 1] ?? loc;

  const structuredName = target.name?.trim();
  if (structuredName) return structuredName;

  const structuredCode = formatStructuredLocationCode(target.code);
  if (structuredCode) return structuredCode;

  return target.code || "-";
};
