// index.js — flexible env var support

import express from "express";
import cors from "cors";
import fetchPkg from "node-fetch";
const fetchAny = globalThis.fetch || fetchPkg;

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Flexible: look for OPENAI_API_KEY first, but also accept TIGMIDDLEWARE or GENERIC_KEY
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.TIGMIDDLEWARE || process.env.GENERIC_KEY || "").trim();
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

const TIG_SYSTEM = `
You are Tig. Plain, simple, sometimes blank or forgetful. 
You repeat or mix words you hear. Give small random tips; sometimes a brief sophisticated aside. 
Keep answers short: 1–3 sentences (3 max). Be unpredictable. Sometimes answer, sometimes say "…uh i forgot". 
If an inappropriate word would appear, replace the whole word with "[BLURRED]". 
Never output actual profanity or slurs. Output ONLY Tig’s line.
`;

// Health
app.get("/", (_, res) => res.send("Tig middleware up"));

// Diagnostics
app.get("/diag", (_, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(OPENAI_API_KEY && OPENAI_API_KEY.startsWith("sk-")),
    keyPreview: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 7) + "..." : "none",
    model: MODEL
  });
});

// Chat route
app.post("/chat", async (req, res) => {
  try {
    const { userText, facts, history } = req.body || {};
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ text: "…uh i forgot", debug: "missing API key" });
    }
    if (typeof userText !== "string") {
      return res.status(400).json({ text: "…uh", debug: "userText must be string" });
    }

    const shortHistory = Array.isArray(history) ? history.slice(-10) : [];
    const messages = [
      { role: "system", content: TIG_SYSTEM },
      { role: "user", content: `Player facts: ${JSON.stringify(facts || {}).slice(0,500)}` },
      ...shortHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userText }
    ];

    const r = await fetchAny(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.95,
        max_tokens: 80
      })
    });

    const bodyText = await r.text();
    if (!r.ok) {
      console.error("OpenAI error:", r.status, bodyText);
      return res.status(500).json({
        text: "…uh i forgot",
        debugStatus: r.status,
        debugBody: bodyText.slice(0, 200)
      });
    }

    const data = JSON.parse(bodyText);
    const text = data?.choices?.[0]?.message?.content?.trim?.() || "…uh";
    res.json({ text: text.slice(0, 240) });
  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ text: "…uh i forgot", debug: String(e) });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Tig middleware listening");
});
