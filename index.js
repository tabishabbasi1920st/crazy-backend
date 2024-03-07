require("dotenv").config();
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const { hash, compare } = require("bcrypt");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const LoginOrRegisterModel = require("./models/loginOrRegisterModel");

app.use(express.json({ limit: "50mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("<h1>Server is running at port 5000</h1>");
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

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

// Token Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers;
  let chatToken;
  if (authHeader != undefined) {
    chatToken = authHeader["authorization"].split(" ")[1];
  }
  if (chatToken === undefined) {
    res.status(401);
    res.send({ message: "Unauthorized user" });
  } else {
    verify(chatToken, process.env.SECRET_KEY, (err, payload) => {
      if (err) {
        res.status(401);
        res.send("Unauthorized user");
      } else {
        req.email = payload.email;
      }
      next();
    });
  }
};

// Register user Api
app.post("/register", async (req, res) => {
  const { name, email, password, img } = req.body;

  // Convert base 64 image data to buffer
  const imageBuffer = Buffer.from(img, "base64");

  // Save the buffer to a file in your desired location
  fs.writeFileSync(`reg_users/${email}_profile_image.png`, imageBuffer);

  try {
    const { name, email, password } = req.body;
    const hashedPassword = await hash(password, 10);

    const newUser = new LoginOrRegisterModel({
      name,
      email,
      password: hashedPassword,
      imageUrl: `reg_users/${email}_profile_image.png`,
    });

    const savedUser = await newUser.save();
    console.log("User inserted into 'chatUser' collection:", savedUser);
    res.status(201).json(savedUser);
  } catch (err) {
    console.log("Error in registering user : ", err);
    if (err.code === 11000) {
      // Duplicate key error (e.g., duplicate email)
      return res.status(400).json({ message: "Email already exists" });
    } else {
      res.status(500).json({ message: "Failed to register user" });
    }
  }
});

//  Login User API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await LoginOrRegisterModel.find({ email });
  // user will be in a list

  if (user.length === 0) {
    res.status(400);
    res.send({ message: "Invalid User." });
  } else {
    const isPasswordMatched = await compare(password, user[0].password);
    if (isPasswordMatched) {
      const payload = { email };
      const jwtToken = sign(payload, process.env.SECRET_KEY);
      res.status(200);
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send({ message: "Invalid Password" });
    }
  }
});
