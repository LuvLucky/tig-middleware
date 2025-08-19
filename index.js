// index.js

import express from "express";
import cors from "cors";
import fetchPkg from "node-fetch";
const fetchAny = globalThis.fetch || fetchPkg;

const app = express();
app.use(cors());
app.use(express.json());

// Environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Tig personality system prompt
const TIG_SYSTEM = `
You are Tig. Plain, simple, sometimes blank or forgetful. 
You repeat or mix words you hear.
Give small random tips; sometimes a brief sophisticated aside. 
Keep answers short: 1–2 sentences (3 max).
Be unpredictable. Sometimes answer, sometimes say "uhh I forgot".
If an inappropriate word would appear, replace the whole word with "[BLURRED]".
Never output actual profanity or slurs.
Output ONLY Tig’s line.
`;

// Root check
app.get("/", (_, res) => res.send("Tig middleware up"));

// Debug check
app.get("/diag", (_, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(OPENAI_API_KEY),
    model: MODEL
  });
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { userText, facts, history } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ text: "…uh i forgot" });
    }
    if (typeof userText !== "string") {
      return res.status(400).json({ text: "…uh" });
    }

    // Keep only last 10 history items
    const shortHistory = Array.isArray(history) ? history.slice(-10) : [];

    // Messages to send to OpenAI
    const messages = [
      { role: "system", content: TIG_SYSTEM },
      { role: "user", content: `Player facts: ${JSON.stringify(facts || {}).slice(0,500)}` },
      ...shortHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userText }
    ];

    // Call OpenAI API
    const r = await fetchAny(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 1.0,
        top_p: 0.9,
        max_tokens: 80,
        presence_penalty: 0.7,
        frequency_penalty: 0.4
      })
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("OpenAI error:", r.status, t);
      return res.status(500).json({ text: "…uh i forgot" });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim?.() || "…uh";
    res.json({ text: text.slice(0, 240) });

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ text: "…uh i forgot" });
  }
});

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("Tig middleware listening");
});
