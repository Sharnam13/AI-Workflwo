import { GoogleGenAI } from "@google/genai";

let client;

/** Returns a Gemini client, or null when GEMINI_API_KEY isn't set (offline/demo mode). */
export const getGemini = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3-flash-preview";
