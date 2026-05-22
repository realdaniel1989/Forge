import "dotenv/config";
import express from "express";
import path from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemma-4-31b-it";

const schemaDescription = `{
  "name": "string (engaging name for the routine)",
  "exercises": [
    {
      "name": "string",
      "bodyPart": "one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio",
      "sets": number,
      "reps": number,
      "weight": number (starting weight in kg),
      "tip": "string (brief form tip)"
    }
  ]
}`;

async function callModel(bodyPart: string): Promise<string> {
  const prompt = `Generate a workout routine for the body part: ${bodyPart}.
Respond with ONLY a JSON object matching this exact shape (no markdown, no commentary):
${schemaDescription}
Include up to 6 exercises maximum.
Specify sets, reps, weight (kg), and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part the exercise primarily targets.`;

  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text output from OpenRouter");
  return text;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-workout", async (req, res) => {
    try {
      const { bodyPart } = req.body;
      if (!bodyPart) {
        return res.status(400).json({ error: "bodyPart is required" });
      }

      let text: string | undefined;
      let retries = 3;
      while (retries > 0) {
        try {
          text = await callModel(bodyPart);
          break;
        } catch (error: any) {
          console.error("OpenRouter API Error:", error.message);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!text) throw new Error("Failed to generate content after retries");
      res.json(JSON.parse(text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: String(error) });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
