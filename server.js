import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "dist")));

// Endpoint to receive GPS update messages
app.post("/gps-update", (req, res) => {
  const { pos, distMoved } = req.body;
  console.log("Received GPS update message:", pos, distMoved);
  res.sendStatus(200);
});

// For any other routes, send the index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
