require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OKX_BASE_URL = process.env.OKX_BASE_URL || "https://www.okx.com";

if (!TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env file");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true,
});

function normalizeSymbol(input) {
  let symbol = input.trim().toUpperCase();

  if (symbol.startsWith("/PRICE")) {
    symbol = symbol.replace("/PRICE", "").trim();
  }

  if (!symbol) {
    symbol = "BTC";
  }

  if (!symbol.includes("-")) {
    symbol = `${symbol}-USDT`;
  }

  return symbol;
}

async function getOkxPrice(inputSymbol) {
  const instId = normalizeSymbol(inputSymbol);

  const response = await axios.get(`${OKX_BASE_URL}/api/v5/market/ticker`, {
    params: { instId },
    timeout: 10000,
  });

  const result = response.data;

  if (result.code !== "0" || !result.data || result.data.length === 0) {
    throw new Error(`Invalid symbol: ${instId}`);
  }

  const ticker = result.data[0];

  return {
    symbol: ticker.instId,
    last: Number(ticker.last),
    open24h: Number(ticker.open24h),
    high24h: Number(ticker.high24h),
    low24h: Number(ticker.low24h),
    vol24h: Number(ticker.vol24h),
    timestamp: new Date(Number(ticker.ts)).toLocaleString(),
  };
}

function getMarketStatus(last, open24h) {
  if (!open24h || open24h === 0) {
    return {
      changePercent: 0,
      status: "Neutral",
      emoji: "🟡",
    };
  }

  const changePercent = ((last - open24h) / open24h) * 100;

  if (changePercent > 1) {
    return {
      changePercent,
      status: "Bullish",
      emoji: "🟢",
    };
  }

  if (changePercent < -1) {
    return {
      changePercent,
      status: "Bearish",
      emoji: "🔴",
    };
  }

  return {
    changePercent,
    status: "Neutral",
    emoji: "🟡",
  };
}

function formatPriceMessage(data) {
  const market = getMarketStatus(data.last, data.open24h);

  return `📈 ${data.symbol} Market Update

Current Price: $${data.last.toLocaleString()}
24h Change: ${market.changePercent.toFixed(2)}%

24h High: $${data.high24h.toLocaleString()}
24h Low: $${data.low24h.toLocaleString()}
24h Volume: ${data.vol24h.toLocaleString()}

Market Status: ${market.status} ${market.emoji}

Data Source: OKX Exchange
Updated At: ${data.timestamp}`;
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Please send a crypto symbol and I will return the latest OKX price.

Examples:
BTC
ETH
SOL
DOGE`
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `How to use this bot:

Send a crypto symbol and I will return the latest OKX price.

Examples:
BTC
ETH
SOL
DOGE

Commands:
/price BTC
/price ETH-USDT`
  );
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  if (text === "/start" || text === "/help") return;

  try {
    const data = await getOkxPrice(text);
    const message = formatPriceMessage(data);

    await bot.sendMessage(chatId, message);
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Sorry, I could not find that crypto pair.

Please try examples like:
BTC
ETH
SOL
DOGE
BTC-USDT
ETH-USDT`
    );
  }
});

console.log("Telegram Crypto Price Bot is running...");