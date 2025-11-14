// ---------------------------
// SERVER SETUP
// ---------------------------
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// Serve client files
app.use(express.static(path.join(__dirname, "public")));

// Store rooms and participants
const rooms = {}; 
// Format:
// rooms = {
//   roomCode: {
//      users: {
//         socketId: { name }
//      }
//   }
// }

// ---------------------------
// SOCKET HANDLING
// ---------------------------
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join or create a room
    socket.on("join-room", ({ name, roomCode }) => {
        if (!rooms[roomCode]) {
            // Create new room
            rooms[roomCode] = { users: {} };
        }

        // Limit 10 users
        if (Object.keys(rooms[roomCode].users).length >= 10) {
            socket.emit("room-full");
            return;
        }

        // Add user
        rooms[roomCode].users[socket.id] = { name };
        socket.join(roomCode);

        // Notify existing members
        socket.to(roomCode).emit("user-joined", {
            id: socket.id,
            name
        });

        // Send existing members list to new user
        const userList = Object.entries(rooms[roomCode].users).map(([id, u]) => ({
            id,
            name: u.name
        }));

        socket.emit("room-joined", {
            roomCode,
            users: userList
        });

        console.log(`User ${name} joined room ${roomCode}`);
    });

    // Handle audio relay
    socket.on("audio-stream", ({ roomCode, audioData }) => {
        socket.to(roomCode).emit("audio-stream", {
            id: socket.id,
            audioData
        });
    });

    // Handle mute/unmute
    socket.on("toggle-mute", ({ roomCode, isMuted }) => {
        socket.to(roomCode).emit("user-muted", {
            id: socket.id,
            isMuted
        });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        for (const roomCode in rooms) {
            if (rooms[roomCode].users[socket.id]) {
                const user = rooms[roomCode].users[socket.id];

                delete rooms[roomCode].users[socket.id];
                socket.to(roomCode).emit("user-left", socket.id);

                // Remove empty room
                if (Object.keys(rooms[roomCode].users).length === 0) {
                    delete rooms[roomCode];
                }

                console.log(`User ${user.name} left room ${roomCode}`);
                break;
            }
        }
    });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
