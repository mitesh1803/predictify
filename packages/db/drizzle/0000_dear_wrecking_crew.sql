CREATE TYPE "public"."order_type" AS ENUM('Buy', 'Sell', 'Split', 'Merge');--> statement-breakpoint
CREATE TYPE "public"."position_type" AS ENUM('Yes', 'No');--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"resolution_description" text NOT NULL,
	"yes_orderbook" json NOT NULL,
	"no_orderbook" json NOT NULL,
	"total_qty" integer NOT NULL,
	"resolution" "position_type"
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" text PRIMARY KEY NOT NULL,
	"order_type" "order_type" NOT NULL,
	"qty" integer NOT NULL,
	"price" integer NOT NULL,
	"user_id" text NOT NULL,
	"market_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"market_id" text NOT NULL,
	"type" "position_type" NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "positions_user_market_type_unique" UNIQUE("user_id","market_id","type")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"usd_balance" integer NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_address_idx" ON "users" USING btree ("address");