import type { PurchaseOrderDto } from "./api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days an ordered purchase order has been waiting for delivery, or null when it is not waiting
 * (not ORDERED, nothing open any more, or no usable date). Mirrors the backend overdue rule.
 */
export const getWaitingDays = (order: PurchaseOrderDto, now: Date = new Date()): number | null => {
  if (order.status !== "ORDERED") return null;
  const hasOpenLine = order.lines.some((line) => (line.quantity ?? 0) - (line.receivedQuantity ?? 0) > 0);
  if (!hasOpenLine) return null;

  const reference = new Date(order.orderedAt || order.createdAt);
  if (Number.isNaN(reference.getTime())) return null;
  return Math.floor((now.getTime() - reference.getTime()) / MS_PER_DAY);
};
