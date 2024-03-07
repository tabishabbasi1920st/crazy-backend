require("dotenv").config();
const fs = require("fs");
const https = require("https");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");

app.use(express.json({ limit: "50mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("<h1>Server is running at port 5000</h1>");
});

const PORT = process.env.PORT || 5000;

// Use HTTPS
const httpsOptions = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
};

const server = https.createServer(httpsOptions, app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    methods: ["GET", "POST"],
  },
});

// Connect to mongodb atlas.
const MONGODB_URI = process.env.MONGODB_URI;

const connectDb = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connection successful to DB");
  } catch (error) {
    console.error("Database connection failed");
    process.exit(0);
  }
};

connectDb();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running at port: ${PORT}`);
});
