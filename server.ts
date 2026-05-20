import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Workout Plan Generation Endpoint
  app.post("/api/generate-workout", async (req, res) => {
    try {
      const { bodyPart } = req.body;
      if (!bodyPart) {
        return res.status(400).json({ error: "bodyPart is required" });
      }

      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a workout routine for the body part: ${bodyPart}. 
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part that the exercise primarily targets.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Engaging name for the routine" },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        bodyPart: { type: Type.STRING, description: "Must be exactly one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio" },
                        sets: { type: Type.NUMBER },
                        reps: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER, description: "Suggest starting weight in lbs" },
                        tip: { type: Type.STRING, description: "A quick form tip" }
                      },
                      required: ["name", "bodyPart", "sets", "reps", "weight"]
                    }
                  }
                },
                required: ["name", "exercises"]
              }
            }
          });
          break; // success
        } catch (error: any) {
          console.error("Gemini API Error:", error.message);
          retries--;
          if (retries === 0) {
            throw error;
          }
          // Delay before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!response) {
        throw new Error("Failed to generate content after retries");
      }

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("No text output from Gemini");
      }
      const data = JSON.parse(textOutput);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
