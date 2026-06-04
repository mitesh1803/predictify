# Predictify Frontend Client

A premium, modern prediction market dashboard built using **React 19**, **Vite**, and **TypeScript**. It offers users a fast, interactive experience to analyze event probabilities, inspect YES/NO order books, execute trades, and manage their positions.

---

## 🎨 Design & Aesthetic Features

- **Sleek Dark Mode Glassmorphism:** Uses a polished modern palette, subtle gradients, and card components that mimic glass reflections (`backdrop-filter`) to present a premium financial instrument dashboard.
- **Micro-Animations & Visual Cues:** Incorporates hover animations, transition effects, flashing alerts, and green/red color-coded trade actions.
- **Responsive Layout:** The grid layout scales down to support tablet and mobile screens.

---

## ⚙️ Key Technical Features

### 1. Dual Mode System (Live vs. Demo Simulation)

Predictify has a resilient client-side architecture that detects backend connection health:

- **Live Mode:** Connects to the Express API (running at `VITE_BACKEND_URL`). Calls routes to store and load order books, user portfolios, and transaction logs. Uses Supabase authorization headers.
- **Demo/Simulation Mode (Offline Fallback):** If the client fails to connect to the backend, it falls back to a mock demo workspace.
  - A client-side replica of the **Matching Engine** runs inside the browser.
  - Orderbooks, user balances, positions, and history logs are read from and written to `localStorage`.
  - Allows full exploration of market trading mechanics without setting up a backend server.

### 2. Solana Web3 Authentication

Authentication is powered by **Supabase Web3 Auth**.

- Clicking "Connect Wallet" triggers a Solana wallet provider sign-in modal using `supabase.auth.signInWithWeb3`.
- The wallet signs a cryptographic challenge to prove ownership.
- Supabase stores the verified wallet address inside custom claims (`claims.custom_claims.address`), which are extracted by the backend for authentication.

### 3. Orderbook Decoding Logic

The event orderbooks are fetched from the server as two objects: `yesOrderbook` and `noOrderbook` representing active limit asks. The frontend dynamically computes bid/ask tables:

- **YES Asks:** Directly rendered from active YES sell orders.
- **YES Bids:** Derived by taking NO asks and subtracting them from 100 (`100 - noAskPrice`).
- **NO Asks:** Directly rendered from active NO sell orders.
- **NO Bids:** Derived by taking YES asks and subtracting them from 100 (`100 - yesAskPrice`).
- **Implied Event Probability:** Calculated as the midpoint between the best YES bid and YES ask.

---

## 📂 Project Structure

```
apps/frontend/src/
├── assets/          # Static files (icons, logos)
├── components/      # UI components (modal dialogs, buttons, cards)
├── hooks/           # Custom React hooks
│   └── useUser.ts   # Retrieves Supabase auth session, profile, and claims
├── lib/             # Third-party integrations
│   └── supabaseClient.ts # Supabase JS configuration client
├── types/           # Global TypeScript type definitions
├── App.tsx          # Main entry file containing the trading dashboard interface
├── App.css          # Core layout, glassmorphism, and color styling rules
├── index.css        # Typography and global CSS reset styling
└── main.tsx         # Root renderer
```

---

## 🔑 Environment Setup

Create an `.env` file in `apps/frontend/` with the following variables:

```env
# Supabase configuration details
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key

# Address of your backend server (e.g. http://localhost:3000 for local dev)
VITE_BACKEND_URL=http://localhost:3000
```

---

## 🚀 Running the Client

Ensure you have installed the monorepo dependencies first.

### Development

Start the client-side server locally:

```bash
bun run dev
```

The application will open on [http://localhost:5173](http://localhost:5173).

### Build & Deploy

Compile the TypeScript files and bundle the production assets using Vite:

```bash
bun run build
```

The output directory will be created under `dist/`, which is ready to be hosted on Vercel, Netlify, or Railway.

---

## 📈 Interactive Features

1. **Market Catalog:** Filter events by category (e.g. All, Crypto, Tech, Science) and search for event titles.
2. **Trading Widget:**
   - **Buy Tab:** Place limit orders to buy YES or NO shares at your chosen price (1-99¢).
   - **Sell Tab:** Sell your existing YES or NO positions back to the orderbook.
   - **Split Tab:** Mint a pair of YES and NO shares for $1.00 USD.
   - **Merge Tab:** Redeem a YES and NO share pair back to $1.00 USD cash.
3. **Liquidity Pools Orderbook:** Displays tables showing available order sizes at different price increments for YES and NO outcomes.
4. **Fund Ramps Modal:** Click "Deposit" or "Withdraw" to instantly onramp/offramp simulated test funds into your wallet balance.
5. **Portfolio & Ledger Log:** Inspect active positions and historical actions at the bottom of the screen.
