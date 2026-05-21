import "dotenv/config";
import express from "express";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const responseSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Engaging name for the routine" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          bodyPart: { type: "string", description: "Must be exactly one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio" },
          sets: { type: "number" },
          reps: { type: "number" },
          weight: { type: "number", description: "Suggest starting weight in lbs" },
          tip: { type: "string", description: "A quick form tip" },
        },
        required: ["name", "bodyPart", "sets", "reps", "weight"],
      },
    },
  },
  required: ["name", "exercises"],
};

async function callGemini(bodyPart: string): Promise<string> {
  const prompt = `Generate a workout routine for the body part: ${bodyPart}.
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part that the exercise primarily targets.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "aistudio-build",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text output from Gemini");
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
          text = await callGemini(bodyPart);
          break;
        } catch (error: any) {
          console.error("Gemini API Error:", error.message);
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
