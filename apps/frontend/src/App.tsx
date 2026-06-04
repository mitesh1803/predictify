import { useEffect, useState, useMemo } from "react";
import "./App.css";
import { useUser } from "./hooks/useUser";
import supabase from "./lib/supabaseClient";
import axios from "axios";

// TypeScript Interfaces
interface Market {
  id: string;
  title: string;
  description: string;
  resolutionDescription: string;
  yesOrderbook: any;
  noOrderbook: any;
  totalQty: number;
  resolution: string | null;
}

interface Position {
  id: string;
  userId: string;
  marketId: string;
  type: "Yes" | "No";
  qty: number;
}

interface HistoryItem {
  id: string;
  orderType: "Buy" | "Sell" | "Split" | "Merge" | "Onramp" | "Offramp";
  qty: number;
  price: number;
  userId: string;
  marketId: string;
  createdAt?: string;
  marketTitle?: string;
}

// Initial Mock Markets for Demo/Simulation Mode
const INITIAL_MOCK_MARKETS: Market[] = [
  {
    id: "solana-500-2026",
    title: "Will Solana touch $500 in 2026?",
    description: "Solana must trade at or above $500.00 USD on any major exchange before Dec 31, 2026.",
    resolutionDescription: "Source: Binance/Coinbase daily close price.",
    yesOrderbook: {
      "62": { availableQty: 120, orders: [{ userId: "alice", qty: 120, filledQty: 0, originalOrderId: "m1", reverseOrder: false }] },
      "65": { availableQty: 300, orders: [{ userId: "bob", qty: 300, filledQty: 0, originalOrderId: "m2", reverseOrder: false }] }
    },
    noOrderbook: {
      "40": { availableQty: 150, orders: [{ userId: "charlie", qty: 150, filledQty: 0, originalOrderId: "m3", reverseOrder: false }] },
      "44": { availableQty: 250, orders: [{ userId: "dave", qty: 250, filledQty: 0, originalOrderId: "m4", reverseOrder: false }] }
    },
    totalQty: 820,
    resolution: null
  },
  {
    id: "spacex-mars-2028",
    title: "Will SpaceX land humans on Mars by 2028?",
    description: "SpaceX must launch and land a crewed mission on Mars before midnight UTC on Dec 31, 2028.",
    resolutionDescription: "Source: Official NASA or SpaceX announcement.",
    yesOrderbook: {
      "32": { availableQty: 200, orders: [{ userId: "charlie", qty: 200, filledQty: 0, originalOrderId: "m5", reverseOrder: false }] },
      "35": { availableQty: 150, orders: [{ userId: "alice", qty: 150, filledQty: 0, originalOrderId: "m6", reverseOrder: false }] }
    },
    noOrderbook: {
      "70": { availableQty: 180, orders: [{ userId: "bob", qty: 180, filledQty: 0, originalOrderId: "m7", reverseOrder: false }] },
      "72": { availableQty: 300, orders: [{ userId: "dave", qty: 300, filledQty: 0, originalOrderId: "m8", reverseOrder: false }] }
    },
    totalQty: 830,
    resolution: null
  },
  {
    id: "gpt5-release-2026",
    title: "Will OpenAI release GPT-5 by December 2026?",
    description: "OpenAI must officially release or announce the public availability of GPT-5 or equivalent next-generation frontier model before Dec 31, 2026.",
    resolutionDescription: "Source: OpenAI official announcements.",
    yesOrderbook: {
      "75": { availableQty: 400, orders: [{ userId: "bob", qty: 400, filledQty: 0, originalOrderId: "m9", reverseOrder: false }] },
      "78": { availableQty: 250, orders: [{ userId: "dave", qty: 250, filledQty: 0, originalOrderId: "m10", reverseOrder: false }] }
    },
    noOrderbook: {
      "25": { availableQty: 320, orders: [{ userId: "alice", qty: 320, filledQty: 0, originalOrderId: "m11", reverseOrder: false }] },
      "28": { availableQty: 100, orders: [{ userId: "charlie", qty: 100, filledQty: 0, originalOrderId: "m12", reverseOrder: false }] }
    },
    totalQty: 1070,
    resolution: null
  }
];

function App() {
  const { claims } = useUser();

  // Mode state: true = use real backend, false = use local storage/demo simulation
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  // Selection states
  const [marketsList, setMarketsList] = useState<Market[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [marketCategory, setMarketCategory] = useState<string>("All");

  // Balance, Positions, History
  const [usdBalance, setUsdBalance] = useState<number>(0); // in cents ($10.50 => 1050)
  const [positionsList, setPositionsList] = useState<Position[]>([]);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // Trading widget state
  const [tradeTab, setTradeTab] = useState<"buy" | "sell" | "split" | "merge">("buy");
  const [outcomeSide, setOutcomeSide] = useState<"yes" | "no">("yes");
  const [orderPrice, setOrderPrice] = useState<number>(50); // cents, 1-99
  const [orderQty, setOrderQty] = useState<number>(10);
  const [splitMergeAmount, setSplitMergeAmount] = useState<number>(50);

  // Ramp Modals
  const [showRampModal, setShowRampModal] = useState<"onramp" | "offramp" | null>(null);
  const [rampAmount, setRampAmount] = useState<string>("100");

  // Create Market Modal
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [newMarketTitle, setNewMarketTitle] = useState("");
  const [newMarketDesc, setNewMarketDesc] = useState("");
  const [newMarketResolution, setNewMarketResolution] = useState("");
  const [createMarketLoading, setCreateMarketLoading] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Active address
  const userAddress = useMemo(() => {
    if (claims && claims.custom_claims?.address) {
      return claims.custom_claims.address;
    }
    return "DemoSolanaWalletAddress111111111111111111";
  }, [claims]);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Check if backend is available
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/markets`, { timeout: 1500 });
        if (response.data && response.data.markets) {
          setBackendAvailable(true);
          setDemoMode(false);
        }
      } catch (e) {
        setBackendAvailable(false);
        setDemoMode(true);
      }
    };
    checkBackend();
    // Check every 10 seconds
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch / Sync Data
  const fetchData = async () => {
    if (!demoMode && backendAvailable) {
      try {
        // Fetch markets
        const marketsRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/markets`);
        setMarketsList(marketsRes.data.markets);
        if (marketsRes.data.markets.length > 0 && !selectedMarketId) {
          setSelectedMarketId(marketsRes.data.markets[0].id);
        }

        // Fetch auth-based data if signed in
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (token) {
          const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
          const balanceRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/balance`, authHeaders);
          setUsdBalance(balanceRes.data.balance || 0);

          const positionsRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/positions`, authHeaders);
          setPositionsList(positionsRes.data.positions || []);

          // GET /history — read operation, not POST
          const historyRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/history`, authHeaders);
          setHistoryList(historyRes.data.history || []);
        } else {
          setUsdBalance(0);
          setPositionsList([]);
          setHistoryList([]);
        }
      } catch (error) {
        console.error("Error fetching live backend data", error);
      }
    } else {
      // Local Storage Demo/Simulation Mode
      const storedMarkets = localStorage.getItem("demo_markets");
      const storedBalance = localStorage.getItem("demo_balance");
      const storedPositions = localStorage.getItem("demo_positions");
      const storedHistory = localStorage.getItem("demo_history");

      if (storedMarkets) {
        setMarketsList(JSON.parse(storedMarkets));
      } else {
        localStorage.setItem("demo_markets", JSON.stringify(INITIAL_MOCK_MARKETS));
        setMarketsList(INITIAL_MOCK_MARKETS);
      }

      if (storedBalance) {
        setUsdBalance(Number(storedBalance));
      } else {
        localStorage.setItem("demo_balance", "100000"); // $1,000.00
        setUsdBalance(100000);
      }

      if (storedPositions) {
        setPositionsList(JSON.parse(storedPositions));
      } else {
        localStorage.setItem("demo_positions", JSON.stringify([]));
        setPositionsList([]);
      }

      if (storedHistory) {
        setHistoryList(JSON.parse(storedHistory));
      } else {
        localStorage.setItem("demo_history", JSON.stringify([]));
        setHistoryList([]);
      }

      // Set initial selected market if none
      if (marketsList.length > 0 && !selectedMarketId) {
        setSelectedMarketId(marketsList[0].id);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [demoMode, backendAvailable, claims]);

  // Set default selected market when list loaded
  useEffect(() => {
    if (marketsList.length > 0 && !selectedMarketId) {
      setSelectedMarketId(marketsList[0].id);
    }
  }, [marketsList]);

  // Get active market
  const activeMarket = useMemo(() => {
    return marketsList.find(m => m.id === selectedMarketId) || null;
  }, [marketsList, selectedMarketId]);

  // Parse orderbook for active market
  const { yesBids, yesAsks, noBids, noAsks, impliedYesPrice } = useMemo(() => {
    if (!activeMarket) {
      return { yesBids: [], yesAsks: [], noBids: [], noAsks: [], impliedYesPrice: 50 };
    }

    const parseBook = (book: any) => {
      if (typeof book === "string") return JSON.parse(book);
      return book || {};
    };

    const yesOrderbook = parseBook(activeMarket.yesOrderbook);
    const noOrderbook = parseBook(activeMarket.noOrderbook);

    const yesA: { price: number; qty: number }[] = [];
    const yesB: { price: number; qty: number }[] = [];
    const noA: { price: number; qty: number }[] = [];
    const noB: { price: number; qty: number }[] = [];

    // Yes Asks (from yesOrderbook)
    Object.keys(yesOrderbook).forEach(price => {
      const qty = yesOrderbook[price]?.availableQty || 0;
      if (qty > 0) yesA.push({ price: Number(price), qty });
    });

    // Yes Bids (100 - noOrderbook Asks)
    Object.keys(noOrderbook).forEach(price => {
      const qty = noOrderbook[price]?.availableQty || 0;
      if (qty > 0) yesB.push({ price: 100 - Number(price), qty });
    });

    // No Asks (from noOrderbook)
    Object.keys(noOrderbook).forEach(price => {
      const qty = noOrderbook[price]?.availableQty || 0;
      if (qty > 0) noA.push({ price: Number(price), qty });
    });

    // No Bids (100 - yesOrderbook Asks)
    Object.keys(yesOrderbook).forEach(price => {
      const qty = yesOrderbook[price]?.availableQty || 0;
      if (qty > 0) noB.push({ price: 100 - Number(price), qty });
    });

    yesA.sort((a, b) => a.price - b.price);
    yesB.sort((a, b) => b.price - a.price);
    noA.sort((a, b) => a.price - b.price);
    noB.sort((a, b) => b.price - a.price);

    // Calculate implied Yes probability
    let prob = 50;
    if (yesB.length > 0 && yesA.length > 0) {
      prob = Math.round((yesB[0].price + yesA[0].price) / 2);
    } else if (yesB.length > 0) {
      prob = yesB[0].price;
    } else if (yesA.length > 0) {
      prob = yesA[0].price;
    }

    return { yesBids: yesB, yesAsks: yesA, noBids: noB, noAsks: noA, impliedYesPrice: prob };
  }, [activeMarket]);

  // Sync Slider/Price when trade outcome toggles
  useEffect(() => {
    if (tradeTab === "buy") {
      setOrderPrice(outcomeSide === "yes" ? impliedYesPrice : 100 - impliedYesPrice);
    }
  }, [outcomeSide, impliedYesPrice, tradeTab]);

  // Format currency
  const formatUSD = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Copy Address
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(userAddress);
    showNotification("Wallet address copied!", "success");
  };

  // Sign In / Out
  const handleSignIn = async () => {
    try {
      await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "I confirm i want to signIN in prediction market",
      });
      // Register the user in the DB (idempotent — safe to call on every login)
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (token) {
        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/user/register`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {}); // Ignore errors — user may already exist
      }
    } catch (e: any) {
      showNotification("Solana Wallet Connection Failed", "error");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    showNotification("Logged out successfully", "success");
  };

  // Onramp & Offramp
  const handleRampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(rampAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    if (!demoMode && backendAvailable) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          showNotification("You must be logged in to ramp funds", "error");
          return;
        }

        const endpoint = showRampModal === "onramp" ? "onramp" : "offramp";
        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/${endpoint}`,
          { amount },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showNotification(`${showRampModal === "onramp" ? "Deposited" : "Withdrawn"} ${formatUSD(amount * 100)} successfully!`, "success");
        setShowRampModal(null);
        fetchData();
      } catch (err: any) {
        showNotification(err.response?.data?.message || `Error processing ${showRampModal}`, "error");
      }
    } else {
      // Demo simulation ramp
      const currentBalance = Number(localStorage.getItem("demo_balance") || "0");
      const delta = amount * 100;
      const historyStr = localStorage.getItem("demo_history") || "[]";
      const history: HistoryItem[] = JSON.parse(historyStr);

      if (showRampModal === "offramp" && currentBalance < delta) {
        showNotification("Insufficient balance to withdraw", "error");
        return;
      }

      const nextBalance = showRampModal === "onramp" ? currentBalance + delta : currentBalance - delta;
      localStorage.setItem("demo_balance", String(nextBalance));
      setUsdBalance(nextBalance);

      const logItem: HistoryItem = {
        id: crypto.randomUUID(),
        orderType: showRampModal === "onramp" ? "Onramp" : "Offramp",
        qty: delta,
        price: 0,
        userId: "demo-user-address",
        marketId: "",
        createdAt: new Date().toISOString(),
        marketTitle: showRampModal === "onramp" ? "Deposit Funds" : "Withdraw Funds"
      };
      history.unshift(logItem);
      localStorage.setItem("demo_history", JSON.stringify(history));
      setHistoryList(history);

      showNotification(`${showRampModal === "onramp" ? "Deposited" : "Withdrawn"} ${formatUSD(delta)} successfully!`, "success");
      setShowRampModal(null);
    }
  };

  // Split Positions (Local & Live)
  const handleSplit = async () => {
    if (!activeMarket) return;
    const amount = splitMergeAmount;
    if (amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    if (!demoMode && backendAvailable) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          showNotification("You must be logged in to Split", "error");
          return;
        }

        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/split`,
          { marketId: activeMarket.id, amount },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showNotification(`Successfully split ${amount} USD into position pairs`, "success");
        fetchData();
      } catch (err: any) {
        showNotification(err.response?.data?.message || "Error processing split", "error");
      }
    } else {
      // Demo simulation split
      if (usdBalance < amount) {
        showNotification("Insufficient USD balance", "error");
        return;
      }

      // Update balance
      const nextBalance = usdBalance - amount;
      localStorage.setItem("demo_balance", String(nextBalance));
      setUsdBalance(nextBalance);

      // Update positions
      const storedPos = localStorage.getItem("demo_positions") || "[]";
      const positions: Position[] = JSON.parse(storedPos);

      const addPosition = (type: "Yes" | "No") => {
        const existing = positions.find(p => p.marketId === activeMarket.id && p.type === type);
        if (existing) {
          existing.qty += amount;
        } else {
          positions.push({
            id: crypto.randomUUID(),
            userId: "demo-user-address",
            marketId: activeMarket.id,
            type,
            qty: amount
          });
        }
      };

      addPosition("Yes");
      addPosition("No");
      localStorage.setItem("demo_positions", JSON.stringify(positions));
      setPositionsList(positions);

      // Update history
      const storedHist = localStorage.getItem("demo_history") || "[]";
      const history: HistoryItem[] = JSON.parse(storedHist);
      history.unshift({
        id: crypto.randomUUID(),
        orderType: "Split",
        qty: amount,
        price: 0,
        userId: "demo-user-address",
        marketId: activeMarket.id,
        createdAt: new Date().toISOString(),
        marketTitle: activeMarket.title
      });
      localStorage.setItem("demo_history", JSON.stringify(history));
      setHistoryList(history);

      showNotification(`Successfully split $${(amount/100).toFixed(2)} USD into YES and NO shares`, "success");
    }
  };

  // Merge Positions (Local & Live)
  const handleMerge = async () => {
    if (!activeMarket) return;
    const amount = splitMergeAmount;
    if (amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    if (!demoMode && backendAvailable) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          showNotification("You must be logged in to Merge", "error");
          return;
        }

        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/merge`,
          { marketId: activeMarket.id, amount },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showNotification(`Successfully merged position pairs back into ${amount} USD`, "success");
        fetchData();
      } catch (err: any) {
        showNotification(err.response?.data?.message || "Error processing merge", "error");
      }
    } else {
      // Demo simulation merge
      const yesPos = positionsList.find(p => p.marketId === activeMarket.id && p.type === "Yes");
      const noPos = positionsList.find(p => p.marketId === activeMarket.id && p.type === "No");

      if (!yesPos || yesPos.qty < amount || !noPos || noPos.qty < amount) {
        showNotification("Insufficient YES or NO shares to merge", "error");
        return;
      }

      // Update positions
      const storedPos = localStorage.getItem("demo_positions") || "[]";
      const positions: Position[] = JSON.parse(storedPos);

      const decPosition = (type: "Yes" | "No") => {
        const idx = positions.findIndex(p => p.marketId === activeMarket.id && p.type === type);
        if (idx !== -1) {
          positions[idx].qty -= amount;
          if (positions[idx].qty <= 0) {
            positions.splice(idx, 1);
          }
        }
      };

      decPosition("Yes");
      decPosition("No");
      localStorage.setItem("demo_positions", JSON.stringify(positions));
      setPositionsList(positions);

      // Update balance
      const nextBalance = usdBalance + amount;
      localStorage.setItem("demo_balance", String(nextBalance));
      setUsdBalance(nextBalance);

      // Update history
      const storedHist = localStorage.getItem("demo_history") || "[]";
      const history: HistoryItem[] = JSON.parse(storedHist);
      history.unshift({
        id: crypto.randomUUID(),
        orderType: "Merge",
        qty: amount,
        price: 0,
        userId: "demo-user-address",
        marketId: activeMarket.id,
        createdAt: new Date().toISOString(),
        marketTitle: activeMarket.title
      });
      localStorage.setItem("demo_history", JSON.stringify(history));
      setHistoryList(history);

      showNotification(`Successfully merged YES and NO shares back to $${(amount/100).toFixed(2)} USD`, "success");
    }
  };

  // Submit Order (Buy/Sell YES/NO)
  const handlePlaceOrder = async () => {
    if (!activeMarket) return;
    if (orderQty <= 0 || orderPrice <= 0 || orderPrice >= 100) {
      showNotification("Please enter valid quantity and price (1-99)", "error");
      return;
    }

    if (!demoMode && backendAvailable) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          showNotification("You must sign in via Solana to place orders", "error");
          return;
        }

        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/order`,
          {
            marketId: activeMarket.id,
            side: outcomeSide,
            type: tradeTab,
            price: orderPrice,
            qty: orderQty
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showNotification("Order executed successfully!", "success");
        fetchData();
      } catch (err: any) {
        showNotification(err.response?.data?.message || "Error placing order", "error");
      }
    } else {
      // Demo Mode Client Matching Engine
      try {
        const cost = orderQty * orderPrice;
        if (tradeTab === "buy" && usdBalance < cost) {
          showNotification("Insufficient balance", "error");
          return;
        }

        // Lock & Copy state from localStorage
        const storedMarkets = JSON.parse(localStorage.getItem("demo_markets") || "[]");
        const storedPos = JSON.parse(localStorage.getItem("demo_positions") || "[]");
        const storedHist = JSON.parse(localStorage.getItem("demo_history") || "[]");
        let userBal = Number(localStorage.getItem("demo_balance") || "0");

        const marketIndex = storedMarkets.findIndex((m: Market) => m.id === activeMarket.id);
        if (marketIndex === -1) throw new Error("Market not found");
        const m: Market = storedMarkets[marketIndex];

        const parseBookObj = (book: any) => {
          if (typeof book === "string") return JSON.parse(book);
          return book || {};
        };
        const yesOrderbook = parseBookObj(m.yesOrderbook);
        const noOrderbook = parseBookObj(m.noOrderbook);

        const originalOrderId = crypto.randomUUID();

        // Helper updates
        const updatePosQty = (uId: string, sideType: "Yes" | "No", delta: number) => {
          if (uId !== "demo-user-address") return; // Only track demo user's local positions
          const idx = storedPos.findIndex((p: Position) => p.marketId === m.id && p.type === sideType);
          if (idx !== -1) {
            storedPos[idx].qty += delta;
            if (storedPos[idx].qty <= 0) storedPos.splice(idx, 1);
          } else if (delta > 0) {
            storedPos.push({
              id: crypto.randomUUID(),
              userId: "demo-user-address",
              marketId: m.id,
              type: sideType,
              qty: delta
            });
          }
        };

        const updateBal = (uId: string, delta: number) => {
          if (uId === "demo-user-address") {
            userBal += delta;
          }
        };

        // ── YES BUY ──
        if (outcomeSide === "yes" && tradeTab === "buy") {
          let leftQty = orderQty;
          const prices = Object.keys(yesOrderbook).sort((a, b) => Number(a) - Number(b));

          for (const p of prices) {
            if (Number(p) > orderPrice) continue;
            const { orders } = yesOrderbook[p]!;
            for (const order of orders) {
              if (leftQty <= 0) break;
              const matchedQty = Math.min(order.qty, leftQty);
              if (!order.reverseOrder) {
                updatePosQty(order.userId, "Yes", -matchedQty);
                updateBal(order.userId, Number(p) * matchedQty);
              } else {
                updatePosQty(order.userId, "No", matchedQty);
                updateBal(order.userId, -(100 - Number(p)) * matchedQty);
              }
              updatePosQty("demo-user-address", "Yes", matchedQty);
              updateBal("demo-user-address", -(Number(p) * matchedQty));
              leftQty -= matchedQty;
              order.filledQty += matchedQty;
              yesOrderbook[p]!.availableQty -= matchedQty;
            }
          }

          if (leftQty > 0) {
            const oppositePrice = 100 - orderPrice;
            if (!noOrderbook[oppositePrice]) {
              noOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
            }
            noOrderbook[oppositePrice]!.availableQty += leftQty;
            noOrderbook[oppositePrice]!.orders.push({
              qty: leftQty,
              userId: "demo-user-address",
              filledQty: 0,
              originalOrderId,
              reverseOrder: true
            });
          }
        }

        // ── YES SELL ──
        if (outcomeSide === "yes" && tradeTab === "sell") {
          const buyPrice = 100 - orderPrice;
          const userHasQty = storedPos.find((p: Position) => p.marketId === m.id && p.type === "Yes")?.qty || 0;
          if (userHasQty < orderQty) throw new Error("Insufficient Yes position");

          let leftQty = orderQty;
          const prices = Object.keys(noOrderbook).sort((a, b) => Number(a) - Number(b));

          for (const p of prices) {
            if (Number(p) > buyPrice) continue;
            const { orders } = noOrderbook[p]!;
            for (const order of orders) {
              if (leftQty <= 0) break;
              const matchedQty = Math.min(order.qty, leftQty);
              if (!order.reverseOrder) {
                updatePosQty(order.userId, "No", -matchedQty);
                updateBal(order.userId, Number(p) * matchedQty);
              } else {
                updatePosQty(order.userId, "Yes", matchedQty);
                updateBal(order.userId, -(100 - Number(p)) * matchedQty);
              }
              updatePosQty("demo-user-address", "Yes", -matchedQty);
              updateBal("demo-user-address", Number(p) * matchedQty);
              leftQty -= matchedQty;
              order.filledQty += matchedQty;
              noOrderbook[p]!.availableQty -= matchedQty;
            }
          }

          if (leftQty > 0) {
            if (!yesOrderbook[orderPrice]) {
              yesOrderbook[orderPrice] = { availableQty: 0, orders: [] };
            }
            yesOrderbook[orderPrice]!.availableQty += leftQty;
            yesOrderbook[orderPrice]!.orders.push({
              qty: leftQty,
              userId: "demo-user-address",
              filledQty: 0,
              originalOrderId,
              reverseOrder: false
            });
          }
        }

        // ── NO BUY ──
        if (outcomeSide === "no" && tradeTab === "buy") {
          let leftQty = orderQty;
          const prices = Object.keys(noOrderbook).sort((a, b) => Number(a) - Number(b));

          for (const p of prices) {
            if (Number(p) > orderPrice) continue;
            const { orders } = noOrderbook[p]!;
            for (const order of orders) {
              if (leftQty <= 0) break;
              const matchedQty = Math.min(order.qty, leftQty);
              if (!order.reverseOrder) {
                updatePosQty(order.userId, "No", -matchedQty);
                updateBal(order.userId, Number(p) * matchedQty);
              } else {
                updatePosQty(order.userId, "Yes", matchedQty);
                updateBal(order.userId, -(100 - Number(p)) * matchedQty);
              }
              updatePosQty("demo-user-address", "No", matchedQty);
              updateBal("demo-user-address", -(Number(p) * matchedQty));
              leftQty -= matchedQty;
              order.filledQty += matchedQty;
              noOrderbook[p]!.availableQty -= matchedQty;
            }
          }

          if (leftQty > 0) {
            const oppositePrice = 100 - orderPrice;
            if (!yesOrderbook[oppositePrice]) {
              yesOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
            }
            yesOrderbook[oppositePrice]!.availableQty += leftQty;
            yesOrderbook[oppositePrice]!.orders.push({
              qty: leftQty,
              userId: "demo-user-address",
              filledQty: 0,
              originalOrderId,
              reverseOrder: true
            });
          }
        }

        // ── NO SELL ──
        if (outcomeSide === "no" && tradeTab === "sell") {
          const buyPrice = 100 - orderPrice;
          const userHasQty = storedPos.find((p: Position) => p.marketId === m.id && p.type === "No")?.qty || 0;
          if (userHasQty < orderQty) throw new Error("Insufficient No position");

          let leftQty = orderQty;
          const prices = Object.keys(yesOrderbook).sort((a, b) => Number(a) - Number(b));

          for (const p of prices) {
            if (Number(p) > buyPrice) continue;
            const { orders } = yesOrderbook[p]!;
            for (const order of orders) {
              if (leftQty <= 0) break;
              const matchedQty = Math.min(order.qty, leftQty);
              if (!order.reverseOrder) {
                updatePosQty(order.userId, "Yes", -matchedQty);
                updateBal(order.userId, Number(p) * matchedQty);
              } else {
                updatePosQty(order.userId, "No", matchedQty);
                updateBal(order.userId, -(100 - Number(p)) * matchedQty);
              }
              updatePosQty("demo-user-address", "No", -matchedQty);
              updateBal("demo-user-address", Number(p) * matchedQty);
              leftQty -= matchedQty;
              order.filledQty += matchedQty;
              yesOrderbook[p]!.availableQty -= matchedQty;
            }
          }

          if (leftQty > 0) {
            if (!noOrderbook[orderPrice]) {
              noOrderbook[orderPrice] = { availableQty: 0, orders: [] };
            }
            noOrderbook[orderPrice]!.availableQty += leftQty;
            noOrderbook[orderPrice]!.orders.push({
              qty: leftQty,
              userId: "demo-user-address",
              filledQty: 0,
              originalOrderId,
              reverseOrder: false
            });
          }
        }

        // Log Order
        storedHist.unshift({
          id: originalOrderId,
          orderType: tradeTab === "buy" ? "Buy" : "Sell",
          qty: orderQty,
          price: orderPrice,
          userId: "demo-user-address",
          marketId: m.id,
          createdAt: new Date().toISOString(),
          marketTitle: `${m.title} (${outcomeSide.toUpperCase()})`
        });

        // Set clean books back to market
        m.yesOrderbook = yesOrderbook;
        m.noOrderbook = noOrderbook;

        // Save
        localStorage.setItem("demo_markets", JSON.stringify(storedMarkets));
        localStorage.setItem("demo_positions", JSON.stringify(storedPos));
        localStorage.setItem("demo_history", JSON.stringify(storedHist));
        localStorage.setItem("demo_balance", String(userBal));

        setMarketsList(storedMarkets);
        setPositionsList(storedPos);
        setHistoryList(storedHist);
        setUsdBalance(userBal);

        showNotification(`Order placed: ${tradeTab.toUpperCase()} ${orderQty} shares of ${outcomeSide.toUpperCase()} at ${orderPrice}¢`, "success");
      } catch (err: any) {
        showNotification(err.message || "Error matching order", "error");
      }
    }
  };

  // Filtered Markets list
  const filteredMarkets = useMemo(() => {
    if (marketCategory === "All") return marketsList;
    if (marketCategory === "Crypto") return marketsList.filter(m => m.id.includes("solana"));
    if (marketCategory === "Science") return marketsList.filter(m => m.id.includes("mars"));
    if (marketCategory === "Tech") return marketsList.filter(m => m.id.includes("gpt") || m.id.includes("neural"));
    return marketsList;
  }, [marketsList, marketCategory]);

  // Create Market
  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketTitle.trim() || !newMarketDesc.trim() || !newMarketResolution.trim()) {
      showNotification("Please fill in all fields", "error");
      return;
    }

    setCreateMarketLoading(true);
    try {
      if (!demoMode && backendAvailable) {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          showNotification("You must be logged in to create a market", "error");
          return;
        }
        const res = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/markets`,
          {
            title: newMarketTitle,
            description: newMarketDesc,
            resolutionDescription: newMarketResolution,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await fetchData();
        setSelectedMarketId(res.data.market.id);
      } else {
        // Demo mode: add locally
        const slug = newMarketTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 40);
        const newMarket: Market = {
          id: `${slug}-${Date.now()}`,
          title: newMarketTitle,
          description: newMarketDesc,
          resolutionDescription: newMarketResolution,
          yesOrderbook: {},
          noOrderbook: {},
          totalQty: 0,
          resolution: null,
        };
        const updated = [newMarket, ...marketsList];
        localStorage.setItem("demo_markets", JSON.stringify(updated));
        setMarketsList(updated);
        setSelectedMarketId(newMarket.id);
      }

      showNotification("Market created successfully!", "success");
      setShowCreateMarket(false);
      setNewMarketTitle("");
      setNewMarketDesc("");
      setNewMarketResolution("");
    } catch (err: any) {
      showNotification(err.response?.data?.message || "Error creating market", "error");
    } finally {
      setCreateMarketLoading(false);
    }
  };

  return (
    <div>
      {/* Notifications */}
      {notification && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1100,
          padding: "16px 24px",
          borderRadius: "12px",
          backgroundColor: notification.type === "success" ? "rgba(0, 240, 255, 0.15)" : "rgba(255, 0, 122, 0.15)",
          border: `1px solid ${notification.type === "success" ? "var(--yes-color)" : "var(--no-color)"}`,
          color: "#fff",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
          fontWeight: 600,
          animation: "pulse 3s infinite"
        }}>
          {notification.message}
        </div>
      )}

      {/* Header bar */}
      <header className="glass-panel header-bar">
        <div className="logo-container">
          <div className="logo-icon" />
          <h1 className="logo-text">Predictify</h1>
        </div>

        <div className="header-actions">
          {/* Status Indicator */}
          <div className="status-indicator">
            <span className={`pulse-dot ${demoMode ? 'pulse-demo' : 'pulse-live'}`} />
            <span>{demoMode ? "Demo Mode (Simulation)" : "Live Backend"}</span>
            {backendAvailable && (
              <label className="switch" style={{ marginLeft: "8px" }}>
                <input
                  type="checkbox"
                  checked={!demoMode}
                  onChange={(e) => setDemoMode(!e.target.checked)}
                />
                <span className="slider" />
              </label>
            )}
          </div>

          {/* User Signin / wallet info */}
          {claims ? (
            <button className="btn-secondary" onClick={handleSignOut}>
              Sign Out
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSignIn}>
              Connect Solana
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left column */}
        <div className="left-column">
          
          {/* Category Tabs & Markets list */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Markets</h2>
              <button
                id="create-market-btn"
                className="btn-primary"
                style={{
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "10px",
                }}
                onClick={() => setShowCreateMarket(true)}
              >
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>＋</span>
                Add Market
              </button>
            </div>
            <div className="market-tabs">
              {["All", "Crypto", "Science", "Tech"].map((cat) => (
                <button
                  key={cat}
                  className={`tab-btn ${marketCategory === cat ? 'active' : ''}`}
                  onClick={() => setMarketCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="markets-container">
              {filteredMarkets.length === 0 ? (
                <div className="no-data">No active markets available</div>
              ) : (
                filteredMarkets.map((market) => {
                  // calculate implied prob
                  const getImpliedYes = () => {
                    const noBook = typeof market.noOrderbook === "string" ? JSON.parse(market.noOrderbook) : market.noOrderbook;
                    const yesBook = typeof market.yesOrderbook === "string" ? JSON.parse(market.yesOrderbook) : market.yesOrderbook;
                    const asks = Object.keys(yesBook).map(Number).filter(p => (yesBook[String(p)]?.availableQty || 0) > 0);
                    const bids = Object.keys(noBook).map(Number).filter(p => (noBook[String(p)]?.availableQty || 0) > 0).map(p => 100 - p);
                    
                    if (bids.length > 0 && asks.length > 0) return Math.round((bids[0] + asks[0]) / 2);
                    if (bids.length > 0) return bids[0];
                    if (asks.length > 0) return asks[0];
                    return 50;
                  };
                  const prob = getImpliedYes();

                  return (
                    <div
                      key={market.id}
                      className={`glass-panel market-card glass-panel-hover ${selectedMarketId === market.id ? 'selected' : ''}`}
                      onClick={() => setSelectedMarketId(market.id)}
                    >
                      <div>
                        <div className="market-card-title">{market.title}</div>
                        <div className="market-card-desc">{market.description.substring(0, 80)}...</div>
                      </div>
                      <div className="market-card-stats">
                        <div className="prob-circle">{prob}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Market Detail */}
          {activeMarket && (
            <div className="glass-panel market-detail-panel">
              <h2>{activeMarket.title}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "8px" }}>
                {activeMarket.description}
              </p>
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "6px", fontStyle: "italic" }}>
                {activeMarket.resolutionDescription}
              </div>

              {/* Progress probability bar */}
              <div className="probability-bar-container">
                <div className="probability-bar-label">
                  <span style={{ color: "var(--yes-color)" }}>YES: {impliedYesPrice}%</span>
                  <span style={{ color: "var(--no-color)" }}>NO: {100 - impliedYesPrice}%</span>
                </div>
                <div className="probability-bar-bg">
                  <div className="probability-bar-yes" style={{ width: `${impliedYesPrice}%` }} />
                </div>
              </div>

              {/* Area Line Chart Visualization */}
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Implied Probability History</h3>
              <div className="glass-panel chart-container" style={{ padding: "16px", overflow: "hidden" }}>
                {/* Custom SVG Line Chart */}
                <svg width="100%" height="100%" viewBox="0 0 500 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--yes-color)" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="var(--yes-color)" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  
                  {/* Dynamic path */}
                  <path
                    d={`M 0 90 Q 100 ${120 - impliedYesPrice} 200 70 T 400 ${110 - impliedYesPrice} L 500 ${100 - impliedYesPrice}`}
                    fill="none"
                    stroke="var(--yes-color)"
                    strokeWidth="3"
                    style={{ filter: "drop-shadow(0 0 4px var(--yes-glow))" }}
                  />
                  
                  {/* Area fill */}
                  <path
                    d={`M 0 90 Q 100 ${120 - impliedYesPrice} 200 70 T 400 ${110 - impliedYesPrice} L 500 ${100 - impliedYesPrice} L 500 120 L 0 120 Z`}
                    fill="url(#chartGlow)"
                  />
                  
                  {/* Active dot */}
                  <circle cx="500" cy={100 - impliedYesPrice} r="5" fill="var(--yes-color)" />
                </svg>
              </div>

              {/* Orderbook Visualizer */}
              <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginTop: "24px" }}>Orderbooks</h3>
              <div className="orderbook-grid">
                
                {/* YES Orderbook */}
                <div className="orderbook-side">
                  <div className="orderbook-title" style={{ color: "var(--yes-color)" }}>YES Orderbook</div>
                  <div className="orderbook-header">
                    <span>Price</span>
                    <span style={{ textAlign: "right" }}>Shares (Qty)</span>
                  </div>
                  
                  {/* Asks (Sell offers) - Reddish text */}
                  {yesAsks.slice(0, 4).reverse().map((ask, i) => (
                    <div key={`yask-${i}`} className="orderbook-row" style={{ opacity: 0.75 }}>
                      <span style={{ color: "var(--no-color)" }}>{ask.price}¢ (Ask)</span>
                      <span style={{ textAlign: "right" }}>{ask.qty}</span>
                    </div>
                  ))}
                  
                  {/* Spread indicator */}
                  <div style={{ textAlign: "center", fontSize: "0.75rem", margin: "6px 0", color: "var(--text-muted)", borderBlock: "1px solid rgba(255,255,255,0.03)", padding: "2px" }}>
                    Spread: {yesAsks.length > 0 && yesBids.length > 0 ? `${yesAsks[0].price - yesBids[0].price}¢` : "0¢"}
                  </div>

                  {/* Bids (Buy offers) - Greenish text */}
                  {yesBids.slice(0, 4).map((bid, i) => (
                    <div key={`ybid-${i}`} className="orderbook-row">
                      <span style={{ color: "var(--yes-color)" }}>{bid.price}¢ (Bid)</span>
                      <span style={{ textAlign: "right" }}>{bid.qty}</span>
                    </div>
                  ))}

                  {yesAsks.length === 0 && yesBids.length === 0 && (
                    <div className="no-data" style={{ padding: "10px" }}>Orderbook empty</div>
                  )}
                </div>

                {/* NO Orderbook */}
                <div className="orderbook-side">
                  <div className="orderbook-title" style={{ color: "var(--no-color)" }}>NO Orderbook</div>
                  <div className="orderbook-header">
                    <span>Price</span>
                    <span style={{ textAlign: "right" }}>Shares (Qty)</span>
                  </div>

                  {/* Asks (Sell offers) */}
                  {noAsks.slice(0, 4).reverse().map((ask, i) => (
                    <div key={`nask-${i}`} className="orderbook-row" style={{ opacity: 0.75 }}>
                      <span style={{ color: "var(--yes-color)" }}>{ask.price}¢ (Ask)</span>
                      <span style={{ textAlign: "right" }}>{ask.qty}</span>
                    </div>
                  ))}

                  {/* Spread indicator */}
                  <div style={{ textAlign: "center", fontSize: "0.75rem", margin: "6px 0", color: "var(--text-muted)", borderBlock: "1px solid rgba(255,255,255,0.03)", padding: "2px" }}>
                    Spread: {noAsks.length > 0 && noBids.length > 0 ? `${noAsks[0].price - noBids[0].price}¢` : "0¢"}
                  </div>

                  {/* Bids (Buy offers) */}
                  {noBids.slice(0, 4).map((bid, i) => (
                    <div key={`nbid-${i}`} className="orderbook-row">
                      <span style={{ color: "var(--no-color)" }}>{bid.price}¢ (Bid)</span>
                      <span style={{ textAlign: "right" }}>{bid.qty}</span>
                    </div>
                  ))}

                  {noAsks.length === 0 && noBids.length === 0 && (
                    <div className="no-data" style={{ padding: "10px" }}>Orderbook empty</div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Right column */}
        <div className="right-column">
          
          {/* Wallet Balance widget */}
          <div className="glass-panel wallet-card">
            <div className="balance-title">USD Balance</div>
            <div className="balance-amount">{formatUSD(usdBalance)}</div>
            <div className="wallet-address">
              <span>{userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 6)}</span>
              <span className="wallet-address-copy" onClick={handleCopyAddress}>Copy</span>
            </div>
            <div className="wallet-actions">
              <button className="btn-primary" onClick={() => { setRampAmount("100"); setShowRampModal("onramp"); }}>Deposit</button>
              <button className="btn-secondary" onClick={() => { setRampAmount("100"); setShowRampModal("offramp"); }}>Withdraw</button>
            </div>
          </div>

          {/* Trade Widget */}
          {activeMarket && (
            <div className="glass-panel trade-widget">
              <div className="trade-widget-tabs">
                {(["buy", "sell", "split", "merge"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`trade-widget-tab-btn ${tradeTab === tab ? 'active' : ''}`}
                    onClick={() => setTradeTab(tab)}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* BUY & SELL outcome sides */}
              {(tradeTab === "buy" || tradeTab === "sell") && (
                <div>
                  <div className="outcome-selector">
                    <button
                      className={`outcome-btn outcome-btn-yes ${outcomeSide === 'yes' ? 'selected' : ''}`}
                      onClick={() => setOutcomeSide("yes")}
                    >
                      YES
                    </button>
                    <button
                      className={`outcome-btn outcome-btn-no ${outcomeSide === 'no' ? 'selected' : ''}`}
                      onClick={() => setOutcomeSide("no")}
                    >
                      NO
                    </button>
                  </div>

                  <div className="form-group">
                    <div className="form-label">
                      <span>Limit Price</span>
                      <span>{orderPrice}¢</span>
                    </div>
                    <div className="form-input-container">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        className="form-input"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(Math.min(99, Math.max(1, Number(e.target.value))))}
                      />
                      <span className="form-suffix">¢</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="99"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(Number(e.target.value))}
                      className="slider-input"
                    />
                  </div>

                  <div className="form-group">
                    <div className="form-label">
                      <span>Shares (Qty)</span>
                    </div>
                    <div className="form-input-container">
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={orderQty}
                        onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                      />
                      <span className="form-suffix">Shares</span>
                    </div>
                  </div>

                  <div className="trade-summary">
                    <div className="summary-row">
                      <span>Subtotal</span>
                      <span>{formatUSD(orderQty * orderPrice)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Est. Position Value</span>
                      <span>{formatUSD(orderQty * 100)}</span>
                    </div>
                    <div className="summary-row summary-row-bold">
                      <span>Total {tradeTab === "buy" ? "Cost" : "Proceeds"}</span>
                      <span>{formatUSD(orderQty * orderPrice)}</span>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
                    onClick={handlePlaceOrder}
                  >
                    Place {tradeTab.toUpperCase()} Order
                  </button>
                </div>
              )}

              {/* SPLIT / MERGE outcomes */}
              {(tradeTab === "split" || tradeTab === "merge") && (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.4" }}>
                    {tradeTab === "split" 
                      ? "Split allows you to convert USD cash directly into matching pairs of YES and NO shares. $1.00 USD gives you 100 YES shares and 100 NO shares."
                      : "Merge allows you to burn equal quantities of YES and NO shares to reclaim USD cash. 100 YES and 100 NO shares returns $1.00 USD."
                    }
                  </div>

                  <div className="form-group">
                    <div className="form-label">
                      <span>Amount (in USD cents)</span>
                      <span>{formatUSD(splitMergeAmount)}</span>
                    </div>
                    <div className="form-input-container">
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={splitMergeAmount}
                        onChange={(e) => setSplitMergeAmount(Math.max(1, Number(e.target.value)))}
                      />
                      <span className="form-suffix">¢</span>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
                    onClick={tradeTab === "split" ? handleSplit : handleMerge}
                  >
                    Execute {tradeTab.toUpperCase()}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Footer Tables (Holdings & History) */}
      <div className="glass-panel portfolio-card" style={{ marginBottom: "24px" }}>
        <h2 className="section-title">Your Holdings</h2>
        
        {positionsList.length === 0 ? (
          <div className="no-data">You do not hold any YES/NO positions currently</div>
        ) : (
          <table className="positions-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Outcome Side</th>
                <th>Quantity (Cents)</th>
                <th>Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {positionsList.map((pos) => {
                const market = marketsList.find(m => m.id === pos.marketId);
                return (
                  <tr key={pos.id}>
                    <td style={{ fontWeight: 600 }}>{market ? market.title : pos.marketId}</td>
                    <td>
                      <span className={`badge ${pos.type === 'Yes' ? 'badge-yes' : 'badge-no'}`}>
                        {pos.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--mono-font)" }}>{pos.qty}</td>
                    <td style={{ fontFamily: "var(--mono-font)", fontWeight: 600 }}>
                      {formatUSD(pos.qty)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* History timeline log */}
      <div className="glass-panel history-card">
        <h2 className="section-title">Activity Log</h2>
        <div className="history-list">
          {historyList.length === 0 ? (
            <div className="no-data">No history items found</div>
          ) : (
            historyList.map((item) => (
              <div key={item.id} className={`history-item ${item.orderType.toLowerCase()}`}>
                <div className="history-left">
                  <span className="history-title">
                    {item.orderType.toUpperCase()} - {item.marketTitle || item.marketId}
                  </span>
                  <span className="history-time">
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="history-right">
                  {item.orderType === "Onramp" || item.orderType === "Offramp" ? (
                    <span style={{ color: item.orderType === "Onramp" ? "var(--yes-color)" : "var(--no-color)" }}>
                      {item.orderType === "Onramp" ? "+" : "-"}{formatUSD(item.qty)}
                    </span>
                  ) : item.orderType === "Split" || item.orderType === "Merge" ? (
                    <span>{formatUSD(item.qty)}</span>
                  ) : (
                    <span>{item.qty} shares @ {item.price}¢</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Onramp/Offramp Modals */}
      {showRampModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: "1.2rem" }}>
                {showRampModal === "onramp" ? "Deposit USD (Deposit)" : "Withdraw USD (Withdraw)"}
              </h2>
              <button className="modal-close" onClick={() => setShowRampModal(null)}>&times;</button>
            </div>
            
            <form onSubmit={handleRampSubmit}>
              <div className="form-group">
                <div className="form-label">Amount (in USD)</div>
                <div className="form-input-container">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    value={rampAmount}
                    onChange={(e) => setRampAmount(e.target.value)}
                    required
                  />
                  <span className="form-suffix">USD</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", padding: "12px", marginTop: "10px" }}
              >
                Confirm {showRampModal === "onramp" ? "Deposit" : "Withdrawal"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Market Modal */}
      {showCreateMarket && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateMarket(false); }}>
          <div className="glass-panel modal-content" style={{ maxWidth: "520px", width: "90%" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.2rem" }}>＋ Create New Market</h2>
              <button className="modal-close" onClick={() => setShowCreateMarket(false)}>&times;</button>
            </div>

            <form onSubmit={handleCreateMarket}>
              <div className="form-group" style={{ marginTop: "8px" }}>
                <div className="form-label">Market Question</div>
                <div className="form-input-container">
                  <input
                    id="new-market-title"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Will Bitcoin hit $200k by end of 2026?"
                    value={newMarketTitle}
                    onChange={(e) => setNewMarketTitle(e.target.value)}
                    maxLength={200}
                    required
                    style={{ paddingRight: "12px" }}
                  />
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
                  {newMarketTitle.length}/200
                </div>
              </div>

              <div className="form-group">
                <div className="form-label">Description</div>
                <textarea
                  id="new-market-desc"
                  className="form-input"
                  placeholder="Describe the exact conditions for YES resolution..."
                  value={newMarketDesc}
                  onChange={(e) => setNewMarketDesc(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  required
                  style={{
                    width: "100%",
                    resize: "vertical",
                    fontFamily: "inherit",
                    lineHeight: "1.5",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
                  {newMarketDesc.length}/1000
                </div>
              </div>

              <div className="form-group">
                <div className="form-label">Resolution Source</div>
                <div className="form-input-container">
                  <input
                    id="new-market-resolution"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Source: Coinbase close price on Dec 31, 2026."
                    value={newMarketResolution}
                    onChange={(e) => setNewMarketResolution(e.target.value)}
                    maxLength={500}
                    required
                    style={{ paddingRight: "12px" }}
                  />
                </div>
              </div>

              <button
                id="submit-create-market-btn"
                type="submit"
                className="btn-primary"
                disabled={createMarketLoading}
                style={{
                  width: "100%",
                  padding: "14px",
                  marginTop: "8px",
                  fontSize: "1rem",
                  opacity: createMarketLoading ? 0.7 : 1,
                  cursor: createMarketLoading ? "not-allowed" : "pointer",
                }}
              >
                {createMarketLoading ? "Creating…" : "Create Market"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;