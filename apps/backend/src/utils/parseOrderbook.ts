import type { Orderbook } from "../types/orderbook";

export function parseOrderbook(orderbook: unknown): Orderbook {
  if (typeof orderbook === "string") return JSON.parse(orderbook);
  if (orderbook && typeof orderbook === "object") return orderbook as Orderbook;
  return {};
}
