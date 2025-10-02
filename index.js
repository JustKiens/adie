// index.js (or your bot’s main file)
import { Client, GatewayIntentBits } from "discord.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// The client picks up the API key from env var GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const modelFlash25 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const modelFlash15 = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Keep-alive server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Retry wrapper ---
async function generateWithRetry(model, prompt, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (i === retries - 1) throw err; // last try, fail
      console.warn(`⚠️ Model busy (attempt ${i + 1}), retrying...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

// --- Try 2.5-flash first, fall back to 1.5-flash ---
async function generateResponse(prompt) {
  try {
    const text = await generateWithRetry(modelFlash25, prompt);
    console.log("✅ Response came from: gemini-2.5-flash");
    return text;
  } catch (err) {
    console.warn("⚠️ gemini-2.5-flash failed, switching to gemini-1.5-flash...");
    const text = await generateWithRetry(modelFlash15, prompt);
    console.log("✅ Response came from: gemini-1.5-flash (fallback)");
    return text;
  }
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

const SYSTEM_PROMPT = "You are a helpful friendly assistant. Answer as concisely as possible. If you don't know the answer, just say you don't know. Do not make up an answer. if asked, the bot creator is LostInDark";


client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    // Combine system prompt and user prompt
    const userPrompt = message.content.replace(`<@${client.user.id}>`, "").trim();
    const prompt = `${SYSTEM_PROMPT}\n\nUser: ${userPrompt}`;

    try {
      const waitingMsg = await message.reply("⏳ Waiting for AI response...");
      let replyText = await generateResponse(prompt);

      // Ensure replyText is safe for Discord
      if (typeof replyText !== "string") replyText = String(replyText);
      if (!replyText.trim()) replyText = "[No response from Gemini AI]";
      if (replyText.length > 2000) replyText = replyText.slice(0, 2000);

      await waitingMsg.edit(replyText);
      console.log("🤖 Reply sent:", replyText);
    } catch (err) {
      console.error("❌ Error calling Gemini:", err);
      await message.reply(
        "⚠️ Both Gemini models are overloaded. Please try again later!"
      );
    }
  }
});

client.login(DISCORD_TOKEN);
