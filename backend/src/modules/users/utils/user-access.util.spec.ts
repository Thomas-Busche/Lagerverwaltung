import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { assertCanAccessUser, assertSuperAdmin, isSuperAdmin, resolveWritableBranchId } from "./user-access.util";

const branchManager = { role: "MANAGER", branchId: "b1" };
const superAdmin = { role: "MANAGER", branchId: null };

describe("user-access util", () => {
  it("identifies super-admins only as MANAGER without branch", () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(branchManager)).toBe(false);
    expect(isSuperAdmin({ role: "WAREHOUSE", branchId: null })).toBe(false);
  });

  it("hides users of foreign branches from branch managers", () => {
    expect(() => assertCanAccessUser(branchManager, { branchId: "b2" })).toThrow(NotFoundException);
    expect(() => assertCanAccessUser(branchManager, { branchId: null })).toThrow(NotFoundException);
    expect(() => assertCanAccessUser(branchManager, { branchId: "b1" })).not.toThrow();
    expect(() => assertCanAccessUser(superAdmin, { branchId: "b2" })).not.toThrow();
  });

  it("forbids branch managers to set a foreign or null branchId", () => {
    expect(() => resolveWritableBranchId(branchManager, null, null)).toThrow(ForbiddenException);
    expect(() => resolveWritableBranchId(branchManager, "b2", null)).toThrow(ForbiddenException);
    expect(resolveWritableBranchId(branchManager, undefined, null)).toBe("b1");
    expect(resolveWritableBranchId(branchManager, "b1", null)).toBe("b1");
  });

  it("lets super-admins choose any branch or none", () => {
    expect(resolveWritableBranchId(superAdmin, "b2", null)).toBe("b2");
    expect(resolveWritableBranchId(superAdmin, null, null)).toBeNull();
    expect(resolveWritableBranchId(superAdmin, undefined, null)).toBeNull();
  });

  it("assertSuperAdmin rejects branch managers", () => {
    expect(() => assertSuperAdmin(branchManager)).toThrow(ForbiddenException);
    expect(() => assertSuperAdmin(superAdmin)).not.toThrow();
  });
});
