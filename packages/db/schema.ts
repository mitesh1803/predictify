import {
  pgTable,
  text,
  integer,
  json,
  uniqueIndex,
  index,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";


export const orderTypeEnum = pgEnum("order_type", ["Buy", "Sell", "Split", "Merge"]);
export const positionTypeEnum = pgEnum("position_type", ["Yes", "No"]);


export const users = pgTable(
  "users",
  {
    id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    address:    text("address").notNull().unique(),
    usdBalance: integer("usd_balance").notNull(), // $100.11 => 10011 (2 decimal places)
  },
  (table) => [
    index("users_address_idx").on(table.address),
  ]
);

export const markets = pgTable("markets", {
  id:                    text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title:                 text("title").notNull(),
  description:           text("description").notNull(),
  resolutionDescription: text("resolution_description").notNull(),
  yesOrderbook:          json("yes_orderbook").notNull(),
  noOrderbook:           json("no_orderbook").notNull(),
  totalQty:              integer("total_qty").notNull(),
  resolution:            positionTypeEnum("resolution"), // nullable = optional resolution
});

export const positions = pgTable(
  "positions",
  {
    id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId:   text("user_id").notNull().references(() => users.id),
    marketId: text("market_id").notNull().references(() => markets.id),
    type:     positionTypeEnum("type").notNull(),
    qty:      integer("qty").notNull(),
  },
  (table) => [
    unique("positions_user_market_type_unique").on(table.userId, table.marketId, table.type),
  ]
);

export const orderHistory = pgTable("order_history", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderType: orderTypeEnum("order_type").notNull(),
  qty:       integer("qty").notNull(),
  price:     integer("price").notNull(),
  userId:    text("user_id").notNull().references(() => users.id),
  marketId:  text("market_id").notNull().references(() => markets.id),
});


export const usersRelations = relations(users, ({ many }) => ({
  positions: many(positions),
  orders:    many(orderHistory),
}));

export const marketsRelations = relations(markets, ({ many }) => ({
  positions: many(positions),
  orders:    many(orderHistory),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  user:   one(users,   { fields: [positions.userId],   references: [users.id] }),
  market: one(markets, { fields: [positions.marketId], references: [markets.id] }),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
  user:   one(users,   { fields: [orderHistory.userId],   references: [users.id] }),
  market: one(markets, { fields: [orderHistory.marketId], references: [markets.id] }),
}));