require("dotenv").config();
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const { hash, compare } = require("bcrypt");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const { sign, verify } = require("jsonwebtoken");
const LoginOrRegisterModel = require("./models/loginOrRegisterModel");
const UserModel = require("./models/userModel");
const ChatMessage = require("./models/chatModel");
const { v4 } = require("uuid");

app.use(express.json({ limit: "1000mb" }));
app.use(cors());

// Serving folders..
app.use("/reg_users", express.static("reg_users"));
app.use("/uploads_audio", express.static("uploads_audio"));
app.use("/uploads_video", express.static("uploads_video"));

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

// profile-info api
app.get("/user-info", authenticateToken, async (req, res) => {
  try {
    const { email } = req;
    const user = await UserModel.find({ email });
    if (user.length === 0) {
      res.status(400);
      res.send({ message: "Something went wrong" });
    } else {
      res.status(200);
      res.send({ message: user });
    }
  } catch (err) {
    console.log("Error while  getting the user info : ", err);
  }
});

// all chats api
app.post("/all-chats", async (req, res) => {
  const { user } = req.body;
  try {
    const allChats = await UserModel.find({ email: { $ne: user } });
    res.status(200);
    res.json({ allChats });
  } catch (err) {
    console.log("Error while fetching all chats:", err);
  }
});

// my-chats api
app.get("/my-chats", async (req, res) => {
  const { me, to } = req.query;

  try {
    const messages = await ChatMessage.find({
      $or: [
        { sentBy: me, sentTo: to },
        { sentBy: to, sentTo: me },
      ],
    }).sort({ dateTime: 1 });

    res.status(200);
    res.json(messages);
  } catch (err) {
    console.log("Error while fetching  my chat list : ", err);
  }
});

// upload recordedAudioMessage
app.post("/upload/recorded-audio-message", (req, res) => {
  try {
    const { recordedAudio } = req.body;

    const randomId = v4();
    const bufferedData = new Buffer.from(recordedAudio, "base64");
    fs.writeFileSync(`uploads_audio/audio_${randomId}.wav`, bufferedData);

    const savedAudioUrl = `uploads_audio/audio_${randomId}.wav`;
    console.log("saved recordedAudio successfully", savedAudioUrl);

    res.status(200);
    res.send({ savedAudioUrl });
  } catch (error) {
    res.status(400);
    res.send({ message: "Error" });
    console.log("error in recorded-audio-message api");
  }
});

// upload audio file messages
app.post("/upload/audio", async (req, res) => {
  try {
    const { audio } = req.body;
    const randomId = v4();
    const bufferedData = new Buffer.from(audio, "base64");
    fs.writeFileSync(
      `uploads_audio/audio_${randomId}_simple-audio.wav`,
      bufferedData
    );

    const savedAudioUrl = `uploads_audio/audio_${randomId}_simple-audio.wav`;
    console.log("saved audio successfully", savedAudioUrl);

    res.status(200);
    res.send({ savedAudioUrl });
  } catch (err) {
    res.status(400);
    res.send({ message: "Error" });
    console.log("error in simple-audio-message api");
  }
});

// upload recordedVideoMessage
app.post("/upload/recorded-video-message", async (req, res) => {
  try {
    const { recordedVideo } = req.body;
    const randomId = v4();
    const bufferedData = new Buffer.from(recordedVideo, "base64");
    fs.writeFileSync(`uploads_video/video_${randomId}.wav`, bufferedData);

    const savedVideoUrl = `uploads_video/video_${randomId}.wav`;
    console.log("Saved recorded video successfully", savedVideoUrl);

    res.status(200);
    res.send({ savedVideoUrl });
  } catch (err) {
    res.status(400);
    res.send({ message: "Error" });
    console.log("Error in recorded video message api");
  }
});

const msgDelieveryStatusConstants = {
  pending: "PENDING",
  sent: "SENT",
  seen: "SEEN",
};

const connectedUsers = {};

io.on("connection", (socket) => {
  console.log("new socket connected", socket.id);

  io.emit("connection", "You are connected.");

  // if a user connected then add him into onlineUsers.
  socket.on("AddUser", (emailOfUser) => {
    connectedUsers[emailOfUser] = socket.id;
    io.emit("connectedUsers", Object.keys(connectedUsers));
  });

  console.log(connectedUsers);

  socket.on("TextMessage", async (message, callback) => {
    const { id, sentTo, sentBy, content, timestamp, type, delieveryStatus } =
      message;

    try {
      const newChatMessage = new ChatMessage({
        id,
        content,
        timestamp,
        sentBy,
        sentTo,
        type,
        delieveryStatus,
      });

      // Adding message into database wether user is offline or online it doesn't matter.
      const savedMessage = await newChatMessage.save();
      console.log("saved message", savedMessage);

      // Checking is sentTo user connected or not.
      if (connectedUsers[sentTo]) {
        // If user connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newChatMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly online", result);
        } else {
          console.log("NO document found with this id");
        }

        // Sending messsage to client means sentTo.
        const socketId = connectedUsers[sentTo];
        io.to(socketId).emit("TextMessage", {
          ...message,
          delieveryStatus: msgDelieveryStatusConstants.sent,
        });
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
        });
      } else {
        // if user offline
        console.log("User is offline");

        // If user not connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newChatMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly offline", result);
        } else {
          console.log("NO document found with this id");
        }
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
        });
      }
    } catch (err) {
      console.error("Error while sending private chat into db", err);
      callback({ success: false, msg: "Message not sent." });
    }
  });

  socket.on("NewMsgReaded", (newMessage) => {
    const { id, sentBy, sentTo } = newMessage;
    console.log("Emitting back");
    io.to(connectedUsers[sentTo]).emit("NewMsgReaded", { msgId: id });
  });

  socket.on("updateMyMessageStatus", async (data) => {
    const { me, to } = data;

    const updatedMessages = await ChatMessage.find({
      sentTo: me,
      delieveryStatus: {
        $in: [
          msgDelieveryStatusConstants.pending,
          msgDelieveryStatusConstants.sent,
        ],
      },
    });

    await ChatMessage.updateMany(
      {
        sentTo: me,
        delieveryStatus: {
          $in: [
            msgDelieveryStatusConstants.pending,
            msgDelieveryStatusConstants.sent,
          ],
        },
      },
      { $set: { delieveryStatus: msgDelieveryStatusConstants.seen } }
    );

    io.to(connectedUsers[to]).emit("iHaveSeenAllMessages", updatedMessages);
  });

  socket.on("typing", (msg) => {
    const { sentBy, sentTo, isTyping } = msg;
    console.log(isTyping);
    io.to(connectedUsers[sentTo]).emit("typing", { sentBy, sentTo, isTyping });
  });

  socket.on("RecordedAudioMessage", async (message, callback) => {
    console.log("Audio message recorded");
    try {
      const { id, content, timestamp, sentBy, sentTo, type, delieveryStatus } =
        message;

      // const { uploaded_audio } = content;

      // // convert base64 audio data to buffer
      // const audioBuffer = Buffer.from(uploaded_audio, "base64");

      // // Save the buffer to a file
      // fs.writeFileSync(`uploads_audio/audio_${id}.wav`, audioBuffer);

      const newAudioMessage = new ChatMessage({
        id,
        content,
        timestamp,
        sentBy,
        sentTo,
        type,
        delieveryStatus,
      });

      const savedAudioMessage = await newAudioMessage.save();
      console.log(savedAudioMessage);

      if (connectedUsers[sentTo]) {
        // If user connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newAudioMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly online", result);
        } else {
          console.log("NO document found with this id");
        }

        // Sending messsage to client means sentTo.
        const socketId = connectedUsers[sentTo];
        io.to(socketId).emit("RecordedAudioMessage", {
          ...savedAudioMessage,
          delieveryStatus: msgDelieveryStatusConstants.sent,
        });
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      } else {
        console.log("User is offline");
        // If user not connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newAudioMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        console.log(result);

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly offline", result);
        } else {
          console.log("NO document found with this id");
        }
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      }
    } catch (err) {
      callback({ success: false, message: "Message not sent." });
      console.log("Error while storing audio in the local system.", err);
    }
  });

  socket.on("recordingAudio", (msg) => {
    const { sentBy, sentTo, isRecordingAudio } = msg;
    console.log(sentBy, sentTo, isRecordingAudio);
    io.to(connectedUsers[sentTo]).emit("recordingAudio", {
      sentBy,
      sentTo,
      isRecordingAudio,
    });
  });

  socket.on("AudioFileMessage", async (message, callback) => {
    try {
      const { id, content, timestamp, sentBy, sentTo, type, delieveryStatus } =
        message;

      const newAudioMessage = new ChatMessage({
        id,
        content,
        timestamp,
        sentBy,
        sentTo,
        type,
        delieveryStatus,
      });

      const savedAudioMessage = await newAudioMessage.save();
      console.log(savedAudioMessage);

      if (connectedUsers[sentTo]) {
        // If user connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newAudioMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly online", result);
        } else {
          console.log("NO document found with this id");
        }

        // Sending messsage to client means sentTo.
        const socketId = connectedUsers[sentTo];
        io.to(socketId).emit("AudioFileMessage", {
          ...savedAudioMessage,
          delieveryStatus: msgDelieveryStatusConstants.sent,
        });
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      } else {
        console.log("User is offline");
        // If user not connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newAudioMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        console.log(result);

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly offline", result);
        } else {
          console.log("NO document found with this id");
        }
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      }
    } catch (err) {
      callback({ success: false, message: "Message not sent." });
      console.log("Error while storing simple-audio in the local system.", err);
    }
  });

  socket.on("RecordedVideoMessage", async (message, callback) => {
    try {
      const { id, content, timestamp, sentBy, sentTo, type, delieveryStatus } =
        message;

      const newRecordedVideoMessage = new ChatMessage({
        id,
        content,
        timestamp,
        sentBy,
        sentTo,
        type,
        delieveryStatus,
      });

      const savedRecordedVideoMessage = await newRecordedVideoMessage.save();
      console.log(savedRecordedVideoMessage);

      if (connectedUsers[sentTo]) {
        // If user connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newRecordedVideoMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly online", result);
        } else {
          console.log("NO document found with this id");
        }

        // Sending messsage to client means sentTo.
        const socketId = connectedUsers[sentTo];
        io.to(socketId).emit("RecordedVideoMessage", {
          ...savedRecordedVideoMessage,
          delieveryStatus: msgDelieveryStatusConstants.sent,
        });
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      } else {
        console.log("User is offline");
        // If user not connected then message's delievery status is updating as sent.
        const result = await ChatMessage.findOneAndUpdate(
          { id: newRecordedVideoMessage.id },
          { $set: { delieveryStatus: msgDelieveryStatusConstants.sent } },
          { new: true } // Return the updated document.
        );

        console.log(result);

        // checking wether status  has been changed or not.
        if (result) {
          console.log("Updated succesfuly offline", result);
        } else {
          console.log("NO document found with this id");
        }
        callback({
          success: true,
          msg: msgDelieveryStatusConstants.sent,
          actualMsg: result,
        });
      }
    } catch (err) {}
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);

    // Find and remove the disconnected user
    const disconnectedUser = Object.entries(connectedUsers).find(
      ([key, value]) => value === socket.id
    );

    if (disconnectedUser) {
      const [disconnectedEmail] = disconnectedUser;
      delete connectedUsers[disconnectedEmail];
      io.emit("connectedUsers", Object.keys(connectedUsers));
      console.log(`User ${disconnectedEmail} removed from connected users.`);
    }
  });
});
