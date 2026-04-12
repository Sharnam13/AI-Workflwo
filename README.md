🚀 AI Order Decision Engine

An intelligent backend system that helps D2C brands automatically decide whether an order should be shipped, verified, or cancelled using data-driven logic and AI.

📌 Overview

This project builds a decision layer for e-commerce orders that reduces RTO losses, prevents fraud, and improves delivery success rates.

It evaluates each order using:

Past user behavior
Order details
Location intelligence
Address clarity (via AI)

👉 And outputs a clear decision:
Ship / Verify / Cancel

⚙️ Features
🧠 Order Classification

Automatically classifies orders into:

✅ Ship – Safe to process
⚠️ Verify – Needs customer confirmation
❌ Cancel – High-risk order
📊 Risk Evaluation

Considers multiple signals:

User Data
Fraud history
RTO patterns
Order Data
Order value
Payment type (COD / Prepaid)
Location Risk
Pincode → City mapping
City classification based on remoteness
Address Clarity
AI-based evaluation of address quality
🤖 AI Integration

Uses Google Gemini for:

Address clarity analysis
Generating personalized verification messages
💬 Smart Verification Messages
Dynamic message generation
Context-aware tone
Requests only relevant information from customers
🔍 Explainable Decisions

For every order, the system can answer:

Why was the order shipped?
Why was it marked for verification?
Why was it cancelled?
🔄 Order Management
Fetch decision using order ID
Update final order status
Maintain decision logs
🏗️ Tech Stack
Backend: Node.js, Express
Database: MongoDB (Mongoose)
AI: Google Gemini API
Architecture: Modular (Risk Engine + Decision Engine + AI Layer)
📁 Project Structure
src/
│
├── controllers/        # Request handling logic
├── models/             # Database schemas
├── routes/             # API endpoints
├── services/           # Risk & AI logic
├── utils/              # Helper functions (scoring, etc.)
├── config/             # Environment & DB config
│
└── index.js            # App entry point
🚀 Getting Started
1. Clone the Repository
git clone https://github.com/your-username/ai-order-decision-engine.git
cd ai-order-decision-engine
2. Install Dependencies
npm install
3. Setup Environment Variables

Create a .env file in the root directory:

PORT=8000
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
4. Run the Server
npm run dev

Server will run on:

http://localhost:8000
📡 API Endpoints
🔹 Evaluate Order
POST /api/orders/evaluate

Request Body:

{
  "email": "user@example.com",
  "pincode": "110001",
  "orderValue": 2500,
  "paymentMode": "COD",
  "address": "Full delivery address here"
}
🔹 Get Decision by Order ID
GET /api/decision/:orderId
🔹 Update Final Status
PATCH /api/decision/:orderId
📊 Example Output
{
  "decision": "VERIFY",
  "riskScore": 0.72,
  "reasons": [
    "High COD RTO history",
    "Low address clarity",
    "High-risk delivery location"
  ],
  "message": "Hi Shivam, we need a quick confirmation before processing your order..."
}
💡 Use Cases
D2C brands with high COD volume
Fraud prevention systems
Delivery success optimization
Automated verification workflows
🔮 Future Improvements
ML-based risk prediction
Real-time learning from outcomes
WhatsApp automation integration
Admin dashboard for ops teams
