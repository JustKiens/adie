// index.js (or your bot’s main file)
import { Client, GatewayIntentBits } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// The client picks up the API key from env var GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI(GEMINI_API_KEY);
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
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

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(`<@${client.user.id}>`, "").trim();

    try {
      // Send a temporary message while waiting for AI
      const waitingMsg = await message.reply('⏳ Waiting for AI response...');
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      let replyText = response.text;
      // Try to parse as JSON and extract 'content' if present
      try {
        const json = JSON.parse(response.text);
        if (json && typeof json === 'object' && json.content) {
          replyText = json.content;
        }
      } catch (e) {
        // Not JSON, use plain text
      }
      // Ensure replyText is a string, not empty, and <= 2000 chars
      if (typeof replyText !== 'string') replyText = String(replyText);
      if (!replyText.trim()) replyText = '[No response from Gemini AI]';
      if (replyText.length > 2000) replyText = replyText.slice(0, 2000);
      await waitingMsg.edit(replyText);
      console.log("🤖 Reply sent:", replyText);
    } catch (err) {
      console.error("❌ Error calling Gemini:", err);
      await message.reply("Sorry, I couldn’t get a response from Gemini AI.");
    }
  }
});

client.login(DISCORD_TOKEN);