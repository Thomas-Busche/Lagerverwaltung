import { BadRequestException } from "@nestjs/common";

import { StockService } from "./stock.service";

// Only the decorators are needed to construct the service without a Nest container.
jest.mock("@nestjs/typeorm", () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

interface FakeRestockRow {
  id: string;
  status: "PENDING" | "APPROVED" | "FULFILLED" | "CANCELLED";
  quantityProvided: number;
  quantityNeeded: number;
  note: string | null;
  readyAt: Date | null;
  fulfilledAt: Date | null;
  preparedBy: unknown;
  location: unknown;
}

const REQUEST_ID = "request-1";
const WAREHOUSE_LOCATION = { id: "warehouse-1" };

const createRow = (overrides: Partial<FakeRestockRow> = {}): FakeRestockRow => ({
  id: REQUEST_ID,
  status: "APPROVED",
  quantityProvided: 1,
  quantityNeeded: 1,
  note: null,
  readyAt: null,
  fulfilledAt: null,
  preparedBy: null,
  location: WAREHOUSE_LOCATION,
  ...overrides,
});

// Simulates InnoDB row locking: transactions touching the row run strictly one after another.
const createSerializingDataSource = (row: FakeRestockRow) => {
  let queue: Promise<unknown> = Promise.resolve();
  const manager = {
    findOne: jest.fn(async () => ({ ...row })),
    save: jest.fn(async (entity: FakeRestockRow) => {
      Object.assign(row, entity);
      return entity;
    }),
  };
  return {
    transaction: jest.fn((work: (txManager: typeof manager) => Promise<unknown>) => {
      const run = queue.then(() => work(manager));
      queue = run.catch(() => undefined);
      return run;
    }),
  };
};

const buildService = (row: FakeRestockRow, permissions: string[]) => {
  const loadedRequest = {
    id: REQUEST_ID,
    status: row.status,
    quantityProvided: row.quantityProvided,
    quantityNeeded: row.quantityNeeded,
    item: { id: "item-1", code: "ITEM", description: "Test" },
    vehicle: { id: "vehicle-1", licensePlate: "H-RR 1965", branchId: "branch-1" },
    stockLevel: { id: "stock-level-1" },
    location: WAREHOUSE_LOCATION,
    preparedBy: null,
  };
  const restockRepository = { findOne: jest.fn(async () => loadedRequest) };
  const accessControlService = {
    getEffectivePermissionsForUserId: jest.fn(async () => ({ permissions })),
  };
  const usersService = {
    findOneById: jest.fn(async () => ({ id: "user-1" })),
    findAll: jest.fn(async () => []),
  };
  const dataSource = createSerializingDataSource(row);

  const service = new StockService(
    {} as never,
    {} as never,
    restockRepository as never,
    {} as never,
    {} as never,
    accessControlService as never,
    usersService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never,
    {} as never,
    {} as never,
  );

  const recordMovement = jest.spyOn(service, "recordMovement").mockResolvedValue({} as never);
  const internals = service as unknown as Record<string, unknown>;
  internals.syncRestockRequest = jest.fn(async () => undefined);
  internals.logRestockRequest = jest.fn(async () => undefined);
  internals.getWarehouseAvailabilityByItemIds = jest.fn(async () => new Map());
  internals.mapRestockRequest = jest.fn(() => ({ id: REQUEST_ID }));
  internals.resolveRestockSourceLocation = jest.fn(async () => WAREHOUSE_LOCATION);

  return { service, recordMovement };
};

describe("StockService restock pickup (Erhalten)", () => {
  const technician = { id: "technician-1", role: "TECHNICIAN", vehicleId: "vehicle-1" };

  it("books a provided quantity exactly once when 'Erhalten' is triggered concurrently", async () => {
    const row = createRow();
    const { service, recordMovement } = buildService(row, ["stock.write"]);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => service.updateRestockStatus(REQUEST_ID, { status: "FULFILLED" }, technician)),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    rejected.forEach((result) => expect(result.reason).toBeInstanceOf(BadRequestException));
    expect(recordMovement).toHaveBeenCalledTimes(1);
    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CHECKIN", quantity: 1, source: `restock-pickup:${REQUEST_ID}` }),
      expect.anything(),
    );
    expect(row.status).toBe("FULFILLED");
    expect(row.quantityProvided).toBe(0);
  });

  it("rejects a pickup when nothing is provided any more", async () => {
    const row = createRow({ status: "FULFILLED", quantityProvided: 0, fulfilledAt: new Date() });
    const { service, recordMovement } = buildService(row, ["stock.write"]);

    await expect(service.updateRestockStatus(REQUEST_ID, { status: "FULFILLED" }, technician)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordMovement).not.toHaveBeenCalled();
  });
});

describe("StockService restock provisioning (Bereitstellen / Rückgängig)", () => {
  const warehouse = { id: "warehouse-user-1", role: "WAREHOUSE", vehicleId: null };
  const provide = { status: "APPROVED" as const, quantityProvided: 1 };

  it("books the warehouse stock out only once when 'Bereitstellen' is clicked repeatedly", async () => {
    const row = createRow({ status: "PENDING", quantityProvided: 0 });
    const { service, recordMovement } = buildService(row, ["restock.manage"]);

    await Promise.all(Array.from({ length: 6 }, () => service.updateRestockStatus(REQUEST_ID, provide, warehouse)));

    expect(recordMovement).toHaveBeenCalledTimes(1);
    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CHECKOUT", quantity: 1, source: "Bereitstellung" }),
      expect.anything(),
    );
    expect(row.status).toBe("APPROVED");
    expect(row.quantityProvided).toBe(1);
  });

  it("returns the parts to the warehouse once when 'Rückgängig' is clicked repeatedly", async () => {
    const row = createRow({ status: "APPROVED", quantityProvided: 1 });
    const { service, recordMovement } = buildService(row, ["restock.manage"]);

    await Promise.all(
      Array.from({ length: 6 }, () =>
        service.updateRestockStatus(REQUEST_ID, { status: "PENDING", quantityProvided: 0 }, warehouse),
      ),
    );

    expect(recordMovement).toHaveBeenCalledTimes(1);
    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CHECKIN", quantity: 1, source: "Bereitstellung-Ruecknahme" }),
      expect.anything(),
    );
    expect(row.status).toBe("PENDING");
    expect(row.quantityProvided).toBe(0);
  });

  it("keeps the warehouse stock balanced when provisioning and undoing alternate", async () => {
    const row = createRow({ status: "PENDING", quantityProvided: 0 });
    const { service, recordMovement } = buildService(row, ["restock.manage"]);

    for (let round = 0; round < 3; round += 1) {
      await service.updateRestockStatus(REQUEST_ID, provide, warehouse);
      await service.updateRestockStatus(REQUEST_ID, { status: "PENDING", quantityProvided: 0 }, warehouse);
    }
    await service.updateRestockStatus(REQUEST_ID, provide, warehouse);

    const balance = recordMovement.mock.calls.reduce(
      (sum, [movement]) => sum + (movement.type === "CHECKOUT" ? -movement.quantity : movement.quantity),
      0,
    );
    expect(balance).toBe(-1);
    expect(row.quantityProvided).toBe(1);
  });

  it("rejects a provided quantity above the shortage", async () => {
    const row = createRow({ status: "PENDING", quantityProvided: 0, quantityNeeded: 1 });
    const { service, recordMovement } = buildService(row, ["restock.manage"]);

    await expect(
      service.updateRestockStatus(REQUEST_ID, { status: "APPROVED", quantityProvided: 2 }, warehouse),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(recordMovement).not.toHaveBeenCalled();
  });
});
