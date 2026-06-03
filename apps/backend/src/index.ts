import express from "express";
import cors from "cors";
import marketRouter from "./routes/market.routes";
import walletRouter from "./routes/wallet.routes";
import orderRouter from "./routes/order.routes";
import positionRouter from "./routes/position.routes";
import historyRouter from "./routes/history.routes";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

app.use(marketRouter);
app.use(walletRouter);
app.use(orderRouter);
app.use(positionRouter);
app.use(historyRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
