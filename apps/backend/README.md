# Predictify Backend

The Predictify backend is a high-performance Express server powered by the Bun runtime. It connects to a Supabase Postgres instance via Drizzle ORM and implements the core prediction market state changes, transaction execution, wallet balances, and a real-time order Matching Engine.

---

## 🛠 Features & Design Decisions

### 1. Web3 Solana JWT Authentication

User authentication is managed via Supabase's Web3 (Solana) login system.

- The `auth` middleware intercepts incoming API requests, extracts the JWT bearer token, and validates it against Supabase Auth.
- It parses the token to retrieve custom wallet claims (`claims.custom_claims.address`).
- Requests are rejected if they lack a valid Solana wallet address. The wallet address is then bound to `req.userId` for downstream routes.

### 2. Transaction Safety & Database Locking

Prediction markets require absolute consistency. To prevent double-spending USD balances or selling more position shares than a user owns, all state-changing endpoints (placing orders, splits, merges, deposits, withdrawals) use **Drizzle database transactions** with pessimistic locking:

- `SELECT ... FOR UPDATE` locks are placed on `users` and `markets` tables when executing orders.
- This serializes operations for a given market/user, ensuring that order execution and matching are race-condition free.

### 3. The Matching Engine

The Matching Engine (`MatchingEngineService`) does not require separate bid orderbooks. It runs a unified liquidity system:

- **Only Asks (Sells) are stored:** The database records YES and NO ask books as JSON.
- **Implied Bid Execution:** A Buy YES order at price $P$ acts as an implied Buy YES order, matching against YES asks at or below $P$. If it cannot be matched, it is placed on the opposite book as a NO ASK at price $100 - P$ with `reverseOrder: true`.
- **Match Settlements:** When a match is found:
  - Sellers have their Yes/No share balances decreased, and their USD wallets credited.
  - Buyers have their USD balances decreased, and their Yes/No share balances credited.
  - Remaining quantities are logged back to the orderbooks.

---

## 📂 Project Structure

```
apps/backend/src/
├── db/               # Re-exports the shared database client and schema
├── middleware/       # JWT auth token validator using Supabase client
├── routes/           # REST endpoints grouped by resource
│   ├── market.routes.ts   # Event contracts and resolutions
│   ├── wallet.routes.ts   # Balances, deposits, and withdrawals
│   ├── order.routes.ts    # Orders, splits, and merges
│   ├── position.routes.ts # User shares per market
│   ├── history.routes.ts  # Transaction logs
│   └── user.routes.ts     # User wallet registration
├── schemas/          # Input validation schemas using Zod
├── services/         # Orchestration logic
│   ├── matchingEngine.service.ts # Real-time bid/ask matching
│   ├── order.service.ts          # Core order lifecycle & Split/Merge
│   └── wallet.service.ts         # Portfolio balance & Position state
├── types/            # TypeScript type overrides (Express Request, etc.)
└── utils/            # Helper functions (JSON parsing, formatting)
```

---

## 🔑 Environment Variables

Create an `.env` file in `apps/backend/` containing:

```env
# Database connection (Use PostgreSQL connection pooler for serverless/concurrent requests)
DATABASE_URL=postgresql://postgres.<username>:<password>@<pooler-host>:6543/postgres

# Supabase Auth configurations
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SECRET_KEY=your_supabase_service_role_secret_key
```

---

## 🚀 Running the Server

### Development

Start the Express API server with automatic hot-reloading:

```bash
bun run dev
```

The server will start listening on `http://localhost:3000`.

### Type Checking

Ensure everything compiles cleanly:

```bash
bun run check-types
```

---

## 📡 REST API Reference

All write operations (`POST` requests) and user portfolio lookups require a valid JWT token sent in the `Authorization` header:
`Authorization: Bearer <Supabase_JWT_Token>`

### Event Markets

#### `GET /markets`

- **Description:** Retrieve all active prediction markets.
- **Response `200 OK`:**
  ```json
  {
    "markets": [
      {
        "id": "spacex-mars-2030",
        "title": "Will SpaceX land humans on Mars by December 31, 2030?",
        "description": "...",
        "resolutionDescription": "...",
        "yesOrderbook": {},
        "noOrderbook": {},
        "totalQty": 0,
        "resolution": null
      }
    ]
  }
  ```

#### `GET /market`

- **Description:** Retrieve a single market by its ID.
- **Query Parameters:** `marketId`
- **Response `200 OK`:** Returns the single market object.

#### `POST /markets` [Auth Required]

- **Description:** Create a new prediction market.
- **Request Body:**
  ```json
  {
    "title": "Will Solana hit $400 in 2026?",
    "description": "Solana must close above $400...",
    "resolutionDescription": "Coinbase daily close price chart."
  }
  ```

---

### User & Wallet Portfolio

#### `POST /user/register` [Auth Required]

- **Description:** Register the user's Solana wallet address in the users database. Idempotent.
- **Response `201 Created` / `200 OK`:**
  ```json
  {
    "user": {
      "id": "uuid-string",
      "address": "SolanaWalletAddress...",
      "usdBalance": 0
    },
    "created": true
  }
  ```

#### `GET /user/me` [Auth Required]

- **Description:** Retrieves profile info of the logged-in user.

#### `GET /balance` [Auth Required]

- **Description:** Fetch user's USD balance.
- **Response `200 OK`:**
  ```json
  {
    "balance": 100000
  }
  ```
  _(Note: USD balances are handled in cents. `100000` cents = $1,000.00)_

#### `POST /onramp` [Auth Required]

- **Description:** Deposit USD funds into user's wallet.
- **Request Body:** `{ "amount": 100.00 }`

#### `POST /offramp` [Auth Required]

- **Description:** Withdraw USD funds out of user's wallet.
- **Request Body:** `{ "amount": 50.00 }`

#### `GET /positions` [Auth Required]

- **Description:** Retrieve a list of YES/NO shares the user owns.
- **Response `200 OK`:**
  ```json
  {
    "positions": [
      {
        "id": "position-uuid",
        "userId": "user-uuid",
        "marketId": "market-uuid",
        "type": "Yes",
        "qty": 5000
      }
    ]
  }
  ```

#### `GET /history` [Auth Required]

- **Description:** Retrieve the user's transaction/order history.
- **Response `200 OK`:** Array of order history records.

---

### Trading Operations

#### `POST /split` [Auth Required]

- **Description:** Lock USD to mint equal amounts of YES and NO shares.
- **Request Body:** `{ "marketId": "market-uuid", "amount": 50 }`
- **Outcome:** Deducts $50.00 USD cash; adds 5,000 YES and 5,000 NO shares.

#### `POST /merge` [Auth Required]

- **Description:** Redeem matching YES and NO shares back into USD.
- **Request Body:** `{ "marketId": "market-uuid", "amount": 50 }`
- **Outcome:** Deducts 5,000 YES and 5,000 NO shares; adds $50.00 USD cash.

#### `POST /order` [Auth Required]

- **Description:** Submits a limit order to the matching engine.
- **Request Body:**
  ```json
  {
    "marketId": "market-uuid",
    "side": "yes",
    "type": "buy",
    "price": 60,
    "qty": 100
  }
  ```
  _(Note: `price` is in cents: 1-99. `qty` is the number of shares)_
