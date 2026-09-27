import "dotenv/config";
import { connectDB } from "./db/connection.js";
import { app } from "./app.js";

const port = process.env.PORT || 8000;

try {
  await connectDB();
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
} catch (error) {
  console.error("Failed to start:", error.message);
  process.exit(1);
}
