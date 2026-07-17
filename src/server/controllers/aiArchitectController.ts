import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

export async function analyzeLogsWithGemini(req: Request, res: Response) {
  try {
    const { logs, customPrompt } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not defined in the workspace settings. Please configure it in Settings > Secrets."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const datasetSummary = JSON.stringify(logs, null, 2);

    const systemInstruction = `You are an expert Industrial Data Architect specializing in crane logistics, terminal optimization, and AI model dataset design.
Your task is to analyze the provided dataset of crane job logs and produce highly professional, detailed, structured insights that help transform this raw logs data into an AI-ready dataset for Machine Learning.

Structure your response into 4 distinct, clear sections with headers:

1. 📊 BOTTLENECK & TIMING ANOMALY ANALYSIS:
   - Identify concrete bottlenecks, duration deviations (difference between planned and actual timestamps), and sequence dependencies.
   - Mention specific jobIds from the logs and point out why they deviated.

2. 🗄️ MONGODB SCHEMA OPTIMIZATION ADVICE:
   - Propose custom adjustments to their MongoDB schema.
   - Explain how to model 'Parent' and 'Child' jobs (e.g., recursive child array vs parent reference with indexing) to better capture scheduling dependencies.
   - Provide an actual MongoDB index recommendation (like compound index or partial index).

3. 🧪 FEATURE ENGINEERING STRATEGY:
   - Detail which fields (e.g., Load Weight, Column Distance, Shift Timing, priority) should be engineered as numerical input features.
   - Suggest normalization (MinMax or Standard Scaler), time-of-day cyclical encoding (sine/cosine transformation), or one-hot encoding values for future model training.

4. 🛡️ DATA INTEGRITY & SHIFT RECONCILIATION LOGIC:
   - Provide clean, executable logic (in clean JavaScript/Node.js or Python) that reconciles 10-minute end-of-shift verification data with original requirements.
   - Address how to handle discrepancies (e.g. actual end exceeding planned shift boundary, completed status with completion percentage < 100%).

Maintain a professional, highly informative, and data-driven tone.`;

    const prompt = customPrompt 
      ? `Here is the custom prompt from the engineer: "${customPrompt}"\n\nAnalyze the following dataset of crane job logs:\n${datasetSummary}`
      : `Please analyze the following dataset of crane job logs and provide expert recommendations:\n${datasetSummary}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemInstruction },
        { text: prompt }
      ]
    });

    res.json({
      success: true,
      analysis: response.text
    });
  } catch (error: any) {
    console.error("Gemini AI Architect API error:", error);
    res.status(500).json({
      error: "Failed to generate AI insights.",
      details: error.message || error
    });
  }
}
