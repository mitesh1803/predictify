import { db } from "./index";
import { markets } from "./schema";

async function seed() {
  console.log("Seeding markets...");
  try {
    // Delete existing markets first to start clean
    await db.delete(markets);

    await db.insert(markets).values([
      {
        id: "btc-150k-2026",
        title: "Will Bitcoin (BTC) reach $150,000 in 2026?",
        description:
          "This market resolves to Yes if Bitcoin reaches $150,000.00 or more at any point in UTC time during the calendar year 2026, according to Binance's daily high price chart.",
        resolutionDescription:
          "Resolves to Yes if BTC hits $150k on Binance daily high before Jan 1, 2027.",
        yesOrderbook: {},
        noOrderbook: {},
        totalQty: 0,
      },
      {
        id: "gpt5-2026",
        title: "Will OpenAI announce GPT-5 by December 31, 2026?",
        description:
          "This market resolves to Yes if OpenAI officially announces GPT-5 as a successor language model on or before December 31, 2026.",
        resolutionDescription:
          "Resolves to Yes upon official OpenAI blog or product announcement naming GPT-5.",
        yesOrderbook: {},
        noOrderbook: {},
        totalQty: 0,
      },
      {
        id: "spacex-mars-2030",
        title: "Will SpaceX land humans on Mars by December 31, 2030?",
        description:
          "This market resolves to Yes if SpaceX lands a crewed spacecraft on Mars containing at least one human passenger who survives the landing on or before Dec 31, 2030.",
        resolutionDescription:
          "Resolves to Yes upon official confirmation of a successful crewed landing on Mars by SpaceX.",
        yesOrderbook: {},
        noOrderbook: {},
        totalQty: 0,
      },
    ]);
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}

seed().then(() => process.exit(0));
