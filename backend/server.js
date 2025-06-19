require("dotenv").config();
const express  = require("express");
const http     = require("http");
const cors     = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { Teacher, Poll } = require("./src/models");

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const URL =
  process.env.NODE_ENV === "production"
    ? process.env.MONGODB_URL
    : "";

mongoose
  .connect(URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Controllers (in-lined) ---
async function teacherLogin(req, res) {
  try {
    const username = `teacher${Math.floor(1000 + Math.random() * 9000)}`;
    const teacher  = new Teacher({ username });
    await teacher.save();
    res.status(201).json({ status: "success", username });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
}

async function createPoll(data) {
  const poll = new Poll(data);
  await poll.save();
  return poll.toObject();
}

async function voteOnOption(pollId, optionText) {
  await Poll.findOneAndUpdate(
    { _id: pollId, "options.text": optionText },
    { $inc: { "options.$.votes": 1 } }
  );
}

async function getPolls(req, res) {
  try {
    const { teacherUsername } = req.params;
    const data = await Poll.find({ teacherUsername }).lean();
    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
}

// --- REST Endpoints ---
app.post("/teacher-login", teacherLogin);
app.get("/polls/:teacherUsername", getPolls);
app.get("/", (_, res) => res.send("Polling System Backend"));

// --- WebSocket Setup ---
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], credentials: true },
});

let votesMap = {};
let users    = {};

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("createPoll", async (pollData) => {
    votesMap = {};
    const poll = await createPoll(pollData);
    io.emit("pollCreated", poll);
  });

  socket.on("submitAnswer", async ({ pollId, option }) => {
    votesMap[option] = (votesMap[option] || 0) + 1;
    await voteOnOption(pollId, option);
    io.emit("pollResults", votesMap);
  });

  socket.on("joinChat", ({ username }) => {
    users[socket.id] = username;
    io.emit("participantsUpdate", Object.values(users));
  });

  socket.on("kickOut", (usernameToKick) => {
    for (const [id, name] of Object.entries(users)) {
      if (name === usernameToKick) {
        io.to(id).emit("kickedOut", { message: "You have been kicked out." });
        io.sockets.sockets.get(id)?.disconnect(true);
        delete users[id];
        break;
      }
    }
    io.emit("participantsUpdate", Object.values(users));
  });

  socket.on("chatMessage", (msg) => io.emit("chatMessage", msg));
  socket.on("studentLogin", (name) =>
    socket.emit("loginSuccess", { message: "Login successful", name })
  );

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("participantsUpdate", Object.values(users));
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// --- Start Server ---
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
