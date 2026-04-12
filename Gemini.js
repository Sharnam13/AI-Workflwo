import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Initialize with your key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. FORCE 'v1' version to avoid the v1beta 404 error
const model = genAI.getGenerativeModel(
  { model: "gemini-3-flash-preview" }
);

export const scoreOrder = async function getAddressScore(address) {
  if (!address || address.trim().length < 3) return 3;

  // We use a strict prompt to get JSON since we're on the stable v1 endpoint
  const prompt = `
    Analyze this address for shipping clarity (ignore pincode).
    Return ONLY a JSON object with the key "score" and a number 0-3.
    0=Perfect, 1=Good, 2=Poor, 3=Worst.
    Address: ${address}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Safety: Clean markdown backticks if the model adds them
    const cleanedText = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanedText);
    
    return Number(data.score); 
  } catch (error) {
    console.error("Gemini Scoring Error:", error.message);
    return 3; // Default to worst on failure
  }
}