import type { PurchaseOrder } from "./entities/purchase-order.entity";

export const DEFAULT_OVERDUE_DAYS = 30;
export const MAX_OVERDUE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OverdueOrderView {
  id: string;
  orderNumber: string | null;
  supplierName: string;
  orderedAt: Date;
  ageDays: number;
  openLines: number;
  openQuantity: number;
}

export function clampOverdueDays(days: number | undefined): number {
  if (days === undefined || !Number.isFinite(days)) return DEFAULT_OVERDUE_DAYS;
  return Math.min(MAX_OVERDUE_DAYS, Math.max(1, Math.floor(days)));
}

export function overdueCutoff(days: number, now: Date): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** Orders that were never marked as ordered fall back to their creation date. */
export function orderReferenceDate(order: Pick<PurchaseOrder, "orderedAt" | "createdAt">): Date {
  return order.orderedAt ?? order.createdAt;
}

/** Returns null when nothing is open any more (an ORDERED order whose lines are all received). */
export function toOverdueOrderView(order: PurchaseOrder, now: Date): OverdueOrderView | null {
  let openLines = 0;
  let openQuantity = 0;
  for (const line of order.lines ?? []) {
    const remaining = (line.quantity ?? 0) - (line.receivedQuantity ?? 0);
    if (remaining > 0) {
      openLines += 1;
      openQuantity += remaining;
    }
  }
  if (openLines === 0) return null;

  const orderedAt = orderReferenceDate(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    supplierName: order.supplier?.name ?? "-",
    orderedAt,
    ageDays: Math.floor((now.getTime() - orderedAt.getTime()) / MS_PER_DAY),
    openLines,
    openQuantity,
  };
}
