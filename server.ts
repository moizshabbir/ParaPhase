import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/rephrase", async (req, res) => {
    try {
      const { text, tone, language } = req.body;

      if (!text || !tone) {
        return res.status(400).json({ error: "Text and tone are required." });
      }

      const prompt = `Rephrase the following text to have a ${tone} tone. Provide 3 variations of the rephrased text.
${language ? `Ensure the output is in ${language}.` : ""}
Do not include any extra commentary, just provide the 3 options.

Original text:
${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              variations: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: "The 3 rephrased variations of the original text.",
              },
            },
            required: ["variations"],
          },
        },
      });

      const jsonStr = response.text?.trim() || "{}";
      const result = JSON.parse(jsonStr);

      res.json(result);
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to generate variations." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    app.use(express.static(path.join(process.cwd(), "public")));
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
