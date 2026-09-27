import { getGemini, geminiModel } from "./gemini.js";

const titleCase = (s = "") => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Deterministic message used when Gemini is unavailable. */
export const templateMessage = ({ name, tone, actions }) => {
  let message = `Hi ${titleCase(name) || "there"}, `;
  if (tone === "soft") message += "just a quick check 😊 ";
  else if (tone === "normal") message += "we're about to process your order. ";
  else message += "we need a quick confirmation before processing your order. ";

  const parts = [];
  if (actions.includes("address")) parts.push("please confirm your delivery address");
  if (actions.includes("confirm")) parts.push("let us know if we should proceed");
  if (actions.includes("prepaid")) parts.push("you can switch to prepaid for faster processing");
  let ask = parts.join(" and ");
  if (tone !== "soft") ask = ask.charAt(0).toUpperCase() + ask.slice(1); // follows a full stop
  return message + ask + ".";
};

/** WhatsApp-style verification message. Never mentions risk or internal reasons. */
export const generateVerificationMessage = async ({ name, tone, actions, order }) => {
  const ai = getGemini();
  if (!ai) return { message: templateMessage({ name, tone, actions }), source: "template" };

  const prompt = `
You are writing a WhatsApp message for a D2C order verification.

Customer name: ${titleCase(name).slice(0, 60) || "Customer"}
Order value: ₹${order.orderValue}
City: ${order.city}
Tone: ${tone}
Actions required: ${actions.join(", ")}

Rules:
- 2-3 lines max, simple Indian conversational English
- Do NOT mention risk, fraud or any internal reason
- Natural, not robotic, with a clear call to action

Tone: soft = friendly and casual (emoji ok); normal = professional and calm; firm = slightly urgent, never rude.
Actions: address = confirm delivery address; confirm = confirm the order should proceed; prepaid = suggest switching to prepaid for faster processing.

Output ONLY the message.`;

  try {
    const res = await ai.models.generateContent({ model: geminiModel(), contents: prompt });
    const text = res.text?.trim();
    if (!text) throw new Error("empty response");
    return { message: text, source: "ai" };
  } catch (error) {
    console.error("Gemini message generation failed, using template:", error.message);
    return { message: templateMessage({ name, tone, actions }), source: "template" };
  }
};
