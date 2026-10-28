import { ForbiddenException, NotFoundException } from "@nestjs/common";

interface BranchScoped {
  role?: string;
  branchId?: string | null;
}

/** Super-admin = manager without branch; the only role allowed to act across branches. */
export function isSuperAdmin(user: BranchScoped | undefined | null): boolean {
  return user?.role === "MANAGER" && user.branchId === null;
}

/** Branch managers may only touch users of their own branch (foreign users appear as not found). */
export function assertCanAccessUser(caller: BranchScoped, target: BranchScoped): void {
  if (caller.branchId === null || caller.branchId === undefined) return;
  if (target.branchId !== caller.branchId) {
    throw new NotFoundException("Benutzer nicht gefunden");
  }
}

/**
 * Resolves the branchId a caller may write. Branch managers are pinned to their own branch
 * (never null); only super-admins may pick any branch or none.
 */
export function resolveWritableBranchId(
  caller: BranchScoped,
  requested: string | null | undefined,
  fallback: string | null,
): string | null {
  if (caller.branchId === null || caller.branchId === undefined) {
    return requested === undefined ? fallback : requested;
  }
  if (requested !== undefined && requested !== caller.branchId) {
    throw new ForbiddenException("Keine Berechtigung für andere Niederlassungen");
  }
  return caller.branchId;
}

export function assertSuperAdmin(user: BranchScoped | undefined | null): void {
  if (!isSuperAdmin(user)) {
    throw new ForbiddenException("Nur Super-Admins können diese Aktion ausführen.");
  }
}
