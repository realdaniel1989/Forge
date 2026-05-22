import "dotenv/config";
import express from "express";
import path from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "qwen/qwen3-32b:nitro";

const schemaDescription = `{
  "name": "string (engaging name for the routine)",
  "exercises": [
    {
      "name": "string",
      "bodyPart": "one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio",
      "tip": "string (brief form tip)",
      "plannedSets": [
        {
          "reps": number,
          "weight": number (starting weight in kg),
          "tempo": { "down": number, "holdBottom": number, "up": number | "X", "holdTop": number }
        }
      ]
    }
  ]
}`;

async function callModel(bodyPart: string): Promise<string> {
  const prompt = `You are Julian Smith, aka "The Quad Guy" — a physiotherapist and hypertrophy coach known for controlled eccentrics, intentional stretched-position pauses, and a strict mind-muscle-connection style of lifting. You prescribe tempos that maximize time under tension and protect joints. Slow eccentrics (3–5s), brief pauses at the stretched position when it serves the lift, controlled or explosive concentrics depending on the exercise's intent. You don't add tempo for tempo's sake — every number serves the muscle's job.

Generate a workout routine for the body part: ${bodyPart}.
Respond with ONLY a JSON object matching this exact shape (no markdown, no commentary):
${schemaDescription}
Include up to 6 exercises maximum.
For each exercise, return 3–5 entries in plannedSets. Each entry has reps, weight (kg), and a tempo object.
Tempo numbers are seconds (0–10) for each phase: down (eccentric), holdBottom, up (concentric), holdTop. Use "X" for the up phase to mean explosive.
CRITICAL: every plannedSet within a single exercise MUST share the exact same tempo object. Tempo is set per exercise, not per set. Reps and weight can still vary across sets to build effective schemes (e.g. ramping weight, lower reps on a heavy top set), but the four tempo numbers stay identical for every set of that exercise.
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

function validateRoutineShape(data: any): void {
  if (!data || typeof data !== "object") throw new Error("Response is not an object");
  if (typeof data.name !== "string") throw new Error("Missing name");
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
    throw new Error("Missing or empty exercises array");
  }
  for (const ex of data.exercises) {
    if (!ex || typeof ex.name !== "string") throw new Error("Exercise missing name");
    if (!Array.isArray(ex.plannedSets) || ex.plannedSets.length === 0) {
      throw new Error(`Exercise "${ex.name}" missing plannedSets`);
    }
    for (const p of ex.plannedSets) {
      if (typeof p.reps !== "number" || typeof p.weight !== "number") {
        throw new Error(`Exercise "${ex.name}" has a set without reps/weight`);
      }
    }
  }
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

      let parsed: any;
      let retries = 3;
      while (retries > 0) {
        try {
          const text = await callModel(bodyPart);
          const candidate = JSON.parse(text);
          validateRoutineShape(candidate);
          parsed = candidate;
          break;
        } catch (error: any) {
          console.error("OpenRouter API Error:", error.message);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!parsed) throw new Error("Failed to generate content after retries");
      res.json(parsed);
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
