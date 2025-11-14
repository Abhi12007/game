const socket = io();

// UI elements
const joinScreen = document.getElementById("join-screen");
const roomScreen = document.getElementById("room-screen");
const joinBtn = document.getElementById("joinBtn");
const muteBtn = document.getElementById("muteBtn");
const exitBtn = document.getElementById("exitBtn");
const roomTitle = document.getElementById("room-title");

const leftColumn = document.getElementById("left-column");
const rightColumn = document.getElementById("right-column");

let localStream;
let isMuted = false;
let currentRoom = null;
let userName = null;

// ------------------------------
// JOIN ROOM
// ------------------------------
joinBtn.onclick = async () => {
    userName = document.getElementById("nameInput").value.trim();
    const roomCode = document.getElementById("roomInput").value.trim();

    if (!userName || !roomCode) {
        alert("Enter name and room code!");
        return;
    }

    currentRoom = roomCode;

    socket.emit("join-room", { name: userName, roomCode });
};

// ------------------------------
// SERVER RESPONSES
// ------------------------------
socket.on("room-full", () => {
    alert("Room is full (max 10 users).");
});

socket.on("room-joined", async ({ roomCode, users }) => {
    roomTitle.innerText = `Room: ${roomCode}`;

    joinScreen.classList.add("hidden");
    roomScreen.classList.remove("hidden");

    // Start mic
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startSendingAudio();

    // Display current users
    updateUserList(users);
});

// When a new user joins
socket.on("user-joined", (user) => {
    addUser(user);
});

// When a user leaves
socket.on("user-left", (id) => {
    document.getElementById(id)?.remove();
});

// Handle incoming audio
socket.on("audio-stream", ({ id, audioData }) => {
    playAudio(audioData);
});

// Mute updates
socket.on("user-muted", ({ id, isMuted }) => {
    const el = document.getElementById(id);
    if (el) {
        el.querySelector(".status").innerText = isMuted ? "(Muted)" : "";
    }
});

// ------------------------------
// AUDIO FUNCTIONS
// ------------------------------
function startSendingAudio() {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(localStream);
    const processor = audioCtx.createScriptProcessor(1024, 1, 1);

    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (e) => {
        if (!isMuted) {
            const data = e.inputBuffer.getChannelData(0);
            socket.emit("audio-stream", {
                roomCode: currentRoom,
                audioData: Array.from(data)
            });
        }
    };
}

function playAudio(audioData) {
    const buffer = new Float32Array(audioData);
    const audioCtx = new AudioContext();

    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 44100);
    audioBuffer.copyToChannel(buffer, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    source.connect(audioCtx.destination);
    source.start(0);
}

// ------------------------------
// UI FUNCTIONS
// ------------------------------
function updateUserList(users) {
    leftColumn.innerHTML = "";
    rightColumn.innerHTML = "";

    users.forEach((u, index) => addUser(u));
}

function addUser(user) {
    const div = document.createElement("div");
    div.className = "profile";
    div.id = user.id;

    div.innerHTML = `
        <div class="avatar"></div>
        <div>${user.name} <span class="status"></span></div>
    `;

    // First 5 → left column, next 5 → right
    if (leftColumn.childElementCount < 5) {
        leftColumn.appendChild(div);
    } else {
        rightColumn.appendChild(div);
    }
}

// ------------------------------
// BUTTONS
// ------------------------------
muteBtn.onclick = () => {
    isMuted = !isMuted;
    muteBtn.innerText = isMuted ? "Unmute" : "Mute";

    socket.emit("toggle-mute", {
        roomCode: currentRoom,
        isMuted
    });
};

exitBtn.onclick = () => {
    window.location.reload();
};
