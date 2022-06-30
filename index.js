const express = require("express");
const cors = require("cors");
const http = require('http');
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  }
});

io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on("joinRoom", (roomName) => {
    socket.join(roomName);
    console.log(`User with id ${socket.id} has joined room with room id ${roomName}`);
  })

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  })

  socket.on('disconnect', () => {
    console.log('user disconnected ', socket.id);
})
})

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "users",
});

db.connect((err) => {
  if (err) {
    return console.log("error: " + err.message);
  }
  console.log("Connected to the mysql database!!!");
});

app.post("/api/register", (req, res) => {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;

  db.query(
    "SELECT * from userList WHERE username = ?",
    username,
    (error, response) => {
      if (error) return res.send(error);

      if (response.length > 0) {
        res.send({ exists: true, msg: "User already exists." });
      } else {
        bcrypt.hash(password, 10, (error, hash) => {
          if (error) {
            console.log(error);
          }
          db.query(
            "INSERT INTO userList(username, email, password) VALUES (?, ?, ?)",
            [username, email, hash],
            (error, result) => {
              if (error) {
                console.log(error);
              } else {
                res.send({ exists: false });
              }
            }
          );
        });
      }
    }
  );
});

app.post("/api/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  db.query(
    "SELECT * from userList WHERE username = ?",
    username,
    (error, result) => {
      if (error) return res.send(error);

      if (result.length > 0) {
        bcrypt.compare(password, result[0].password, (error, response) => {
          if (error) return res.send({ error });

          if (response) {
            res.send({ found: true });
          } else {
            res.send({ found: false, msg: "Password is incorrect." });
          }
        });
      } else {
        res.send({ found: false, msg: "User does not exist." });
      }
    }
  );
});

app.get("/api/ContactList", (req, res) => {
  const currentUser = req.query.User;

  db.query(
    "SELECT username, email from userList WHERE username != ?",
    currentUser,
    (error, response) => {
      res.send(response);
    }
  );
});

app.post("/api/send", (req, res) => {
  const room = req.body.room;
  const sender = req.body.sender;
  const receiver = req.body.receiver;
  const message = req.body.message;
  const timestamp = req.body.timestamp;

  db.query(
    "INSERT INTO messageList(message, sender, receiver, timestamp, room) VALUES(?, ?, ?, ?, ?)",
    [message, sender, receiver, timestamp, room],
    (error, response) => {
      if (error) console.log(error);
      else {
        res.send(response);
      }
    }
  );
});

app.get("/api/get", (req, res) => {
  const sender = req.query.sender;
  const receiver = req.query.receiver;

  db.query(
    "SELECT * from messageList WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)",
    [sender, receiver, receiver, sender],
    (error, response) => {
      res.send(response);
    }
  );
});

server.listen(process.env.PORT || 5000, () => {
  console.log("Sever running on port 5000");
});
