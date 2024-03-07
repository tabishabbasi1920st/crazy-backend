const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const app = express();

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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running at port: ${PORT}`);
});
