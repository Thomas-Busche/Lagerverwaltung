import {
  DEFAULT_OVERDUE_DAYS,
  MAX_OVERDUE_DAYS,
  clampOverdueDays,
  overdueCutoff,
  toOverdueOrderView,
} from "./overdue-orders.util";
import type { PurchaseOrder } from "./entities/purchase-order.entity";

const NOW = new Date("2026-11-09T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const buildOrder = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder =>
  ({
    id: "order-1",
    orderNumber: "B-2026-001",
    orderedAt: daysAgo(40),
    createdAt: daysAgo(41),
    supplier: { name: "Toshiba" },
    lines: [
      { quantity: 5, receivedQuantity: 2 },
      { quantity: 3, receivedQuantity: 3 },
      { quantity: 1, receivedQuantity: 0 },
    ],
    ...overrides,
  }) as unknown as PurchaseOrder;

describe("overdue orders", () => {
  it("counts only lines that are still open", () => {
    const view = toOverdueOrderView(buildOrder(), NOW);

    expect(view).toMatchObject({ id: "order-1", supplierName: "Toshiba", openLines: 2, openQuantity: 4, ageDays: 40 });
  });

  it("ignores orders whose lines are all received", () => {
    const order = buildOrder({ lines: [{ quantity: 2, receivedQuantity: 2 }] as never });

    expect(toOverdueOrderView(order, NOW)).toBeNull();
  });

  it("falls back to the creation date when the order was never marked as ordered", () => {
    const view = toOverdueOrderView(buildOrder({ orderedAt: null, createdAt: daysAgo(35) }), NOW);

    expect(view?.ageDays).toBe(35);
    expect(view?.orderedAt).toEqual(daysAgo(35));
  });

  it("computes the cutoff and keeps the day range sane", () => {
    expect(overdueCutoff(30, NOW)).toEqual(daysAgo(30));
    expect(clampOverdueDays(undefined)).toBe(DEFAULT_OVERDUE_DAYS);
    expect(clampOverdueDays(Number.NaN)).toBe(DEFAULT_OVERDUE_DAYS);
    expect(clampOverdueDays(0)).toBe(1);
    expect(clampOverdueDays(99999)).toBe(MAX_OVERDUE_DAYS);
  });
});
