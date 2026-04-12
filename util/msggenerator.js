import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateVerificationMessageAI({
  name,
  tone,
  actions,
  order = {}
}) {
  const model = genAI.getGenerativeModel({
     model: "gemini-3-flash-preview" 
  });

  const prompt = `
You are generating a WhatsApp message for a D2C order verification.

Customer Name: ${name || "Customer"}
Order Value: ₹${order?.totalAmount || ""}
City: ${order?.city || ""}

Tone: ${tone}

Actions required:
${actions.join(", ")}

Instructions:
- Keep message under 2-3 lines
- Use simple Indian conversational tone
- Do NOT mention risk, fraud, or internal reasons
- Make it feel natural, not robotic
- Include clear CTA

Tone guidelines:
- soft: friendly, casual, polite (can use emoji)
- normal: professional, calm
- firm: slightly urgent but not rude

Action mapping:
- address → confirm delivery address
- confirm → confirm if order should proceed
- prepaid → suggest switching to prepaid for faster processing

Output ONLY the final message.
`;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text.trim();

  } catch (error) {
    console.error("Gemini Error:", error);

    let message = `Hi ${name || "there"}, `;

    if (tone === "soft") {
      message += "just a quick check 😊 ";
    } else if (tone === "normal") {
      message += "we’re about to process your order. ";
    } else {
      message += "we need a quick confirmation before processing your order. ";
    }

    const parts = [];

    if (actions.includes("address")) {
      parts.push("please confirm your delivery address");
    }

    if (actions.includes("confirm")) {
      parts.push("let us know if we should proceed");
    }

    if (actions.includes("prepaid")) {
      parts.push("you can switch to prepaid for faster processing");
    }

    message += parts.join(" and ") + ".";

    return message;
  }
}