import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { assertVehicleAccess } from "./vehicle-access";

const vehicles = [
  { id: "v-a1", branchId: "branch-a" },
  { id: "v-a2", branchId: "branch-a" },
  { id: "v-b1", branchId: "branch-b" },
];

// Mimics VehiclesService.findOne: branchId filter only applies when set.
const vehiclesService = {
  findOne: jest.fn(async (id: string, branchId?: string | null) =>
    vehicles.find((v) => v.id === id && (!branchId || v.branchId === branchId)) ?? null),
};

describe("assertVehicleAccess", () => {
  it("rejects a vehicle of a foreign branch", async () => {
    const user = { role: "MANAGER", branchId: "branch-a", vehicleId: null };
    await expect(assertVehicleAccess(vehiclesService as never, user, "v-b1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a technician accessing another vehicle of the same branch", async () => {
    const user = { role: "TECHNICIAN", branchId: "branch-a", vehicleId: "v-a1" };
    await expect(assertVehicleAccess(vehiclesService as never, user, "v-a2")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a technician on their own vehicle", async () => {
    const user = { role: "TECHNICIAN", branchId: "branch-a", vehicleId: "v-a1" };
    await expect(assertVehicleAccess(vehiclesService as never, user, "v-a1")).resolves.toBeUndefined();
  });

  it("allows a manager on any vehicle of their branch and a super-admin everywhere", async () => {
    await expect(
      assertVehicleAccess(vehiclesService as never, { role: "MANAGER", branchId: "branch-a", vehicleId: null }, "v-a2"),
    ).resolves.toBeUndefined();
    await expect(
      assertVehicleAccess(vehiclesService as never, { role: "ADMIN", branchId: null, vehicleId: null }, "v-b1"),
    ).resolves.toBeUndefined();
  });

  it("rejects a missing user", async () => {
    await expect(assertVehicleAccess(vehiclesService as never, undefined, "v-a1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
