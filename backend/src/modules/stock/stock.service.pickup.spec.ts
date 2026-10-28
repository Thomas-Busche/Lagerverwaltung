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
  note: string | null;
  fulfilledAt: Date | null;
  preparedBy: unknown;
}

const REQUEST_ID = "request-1";

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

const buildService = (row: FakeRestockRow) => {
  const loadedRequest = {
    id: REQUEST_ID,
    status: "APPROVED",
    quantityProvided: 1,
    quantityNeeded: 1,
    item: { id: "item-1" },
    vehicle: { id: "vehicle-1" },
    stockLevel: { id: "stock-level-1" },
    preparedBy: null,
  };
  const restockRepository = { findOne: jest.fn(async () => loadedRequest) };
  const accessControlService = {
    getEffectivePermissionsForUserId: jest.fn(async () => ({ permissions: ["stock.write"] })),
  };
  const dataSource = createSerializingDataSource(row);

  const service = new StockService(
    {} as never,
    {} as never,
    restockRepository as never,
    {} as never,
    {} as never,
    accessControlService as never,
    {} as never,
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

  return { service, recordMovement };
};

describe("StockService restock pickup (Erhalten)", () => {
  const actor = { id: "technician-1", role: "TECHNICIAN", vehicleId: "vehicle-1" };

  it("books a provided quantity exactly once when 'Erhalten' is triggered concurrently", async () => {
    const row: FakeRestockRow = {
      id: REQUEST_ID,
      status: "APPROVED",
      quantityProvided: 1,
      note: null,
      fulfilledAt: null,
      preparedBy: null,
    };
    const { service, recordMovement } = buildService(row);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => service.updateRestockStatus(REQUEST_ID, { status: "FULFILLED" }, actor)),
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
    const row: FakeRestockRow = {
      id: REQUEST_ID,
      status: "FULFILLED",
      quantityProvided: 0,
      note: null,
      fulfilledAt: new Date(),
      preparedBy: null,
    };
    const { service, recordMovement } = buildService(row);

    await expect(service.updateRestockStatus(REQUEST_ID, { status: "FULFILLED" }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordMovement).not.toHaveBeenCalled();
  });
});
