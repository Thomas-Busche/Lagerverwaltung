import { NotFoundException } from "@nestjs/common";

import { LocationsService } from "./locations.service";

// Only the decorators are needed to construct the service without a Nest container.
jest.mock("@nestjs/typeorm", () => ({
  InjectRepository: () => () => undefined,
}));

const BRANCH_A = "branch-a";
const BRANCH_B = "branch-b";

const createService = (rows: Array<{ id: string; branchId: string | null; type?: string }>) => {
  const repository = {
    // Mimics the where-clause filtering of the real repository.
    findOne: jest.fn(async ({ where }: { where: { id: string; branchId?: string } }) =>
      rows.find((r) => r.id === where.id && (where.branchId === undefined || r.branchId === where.branchId)) ?? null),
    delete: jest.fn(),
    save: jest.fn(async (e: unknown) => e),
  };
  return { service: new LocationsService(repository as never), repository };
};

describe("LocationsService branch isolation", () => {
  const rows = [
    { id: "loc-a", branchId: BRANCH_A, type: "WAREHOUSE" },
    { id: "loc-b", branchId: BRANCH_B, type: "WAREHOUSE" },
  ];

  it("rejects update of a foreign-branch location", async () => {
    const { service, repository } = createService(rows);
    await expect(service.update("loc-b", { name: "x" }, BRANCH_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("rejects removal of a foreign-branch location", async () => {
    const { service, repository } = createService(rows);
    await expect(service.remove("loc-b", BRANCH_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("allows super-admin (branchId null) to remove any location", async () => {
    const { service, repository } = createService(rows);
    await service.remove("loc-b", null);
    expect(repository.delete).toHaveBeenCalledWith("loc-b");
  });

  it("rejects a parent from another branch on create", async () => {
    const { service } = createService(rows);
    await expect(
      service.create({ type: "SHELF", name: "S", parentId: "loc-b", branchId: BRANCH_A }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a parent from another branch on update", async () => {
    const { service } = createService(rows);
    await expect(service.update("loc-a", { parentId: "loc-b" }, BRANCH_A)).rejects.toBeInstanceOf(NotFoundException);
  });
});
