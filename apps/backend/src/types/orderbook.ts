export interface Order {
  userId: string;
  qty: number;
  filledQty: number;
  originalOrderId: string;
  reverseOrder: boolean;
}

export interface OrderbookEntry {
  availableQty: number;
  orders: Order[];
}

export type Orderbook = Record<string, OrderbookEntry>;
