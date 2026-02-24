import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";

interface Location {
  lat: number;
  lng: number;
}

interface User {
  id: string;
  socketId: string;
  name: string;
  role: "driver" | "passenger";
  location: Location | null;
  isOnline: boolean;
  isPremium: boolean;
}

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
}

const users = new Map<string, User>();
const messages: Message[] = [];

// Add some mock data for demonstration
const mockUsers: User[] = [
  {
    id: "mock1",
    socketId: "mock1",
    name: "Alice (Driver)",
    role: "driver",
    location: { lat: 37.7749, lng: -122.4194 }, // San Francisco center
    isOnline: true,
    isPremium: false,
  },
  {
    id: "mock2",
    socketId: "mock2",
    name: "Bob (Passenger)",
    role: "passenger",
    location: { lat: 37.7759, lng: -122.4184 }, // Close to SF center (within 1km)
    isOnline: true,
    isPremium: false,
  },
  {
    id: "mock3",
    socketId: "mock3",
    name: "Charlie (Driver)",
    role: "driver",
    location: { lat: 37.7949, lng: -122.4394 }, // Further away (approx 3km)
    isOnline: true,
    isPremium: true,
  },
  {
    id: "mock4",
    socketId: "mock4",
    name: "Diana (Passenger)",
    role: "passenger",
    location: { lat: 37.7649, lng: -122.4294 }, // Approx 1.5km away
    isOnline: true,
    isPremium: false,
  },
  {
    id: "mock5",
    socketId: "mock5",
    name: "Eve (Driver)",
    role: "driver",
    location: { lat: 37.7749, lng: -122.4194 }, // Same location as center
    isOnline: false, // Offline, shouldn't show up
    isPremium: false,
  }
];

mockUsers.forEach(u => users.set(u.id, u));

// Helper to calculate distance in km
function getDistance(loc1: Location, loc2: Location) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(loc2.lat - loc1.lat);
  const dLon = deg2rad(loc2.lng - loc1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(loc1.lat)) *
      Math.cos(deg2rad(loc2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" },
  });
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("login", (userData: Omit<User, "socketId" | "id">) => {
      const id = socket.id; // Using socket id as user id for simplicity
      const user: User = { ...userData, id, socketId: socket.id };
      users.set(id, user);
      socket.emit("login_success", user);
      io.emit("users_update", Array.from(users.values()));
    });

    socket.on("update_location", (location: Location) => {
      const user = users.get(socket.id);
      if (user) {
        user.location = location;
        users.set(socket.id, user);
        io.emit("users_update", Array.from(users.values()));
      }
    });

    socket.on("toggle_online", (isOnline: boolean) => {
      const user = users.get(socket.id);
      if (user) {
        user.isOnline = isOnline;
        users.set(socket.id, user);
        io.emit("users_update", Array.from(users.values()));
      }
    });

    socket.on("toggle_premium", (isPremium: boolean) => {
      const user = users.get(socket.id);
      if (user) {
        user.isPremium = isPremium;
        users.set(socket.id, user);
        io.emit("users_update", Array.from(users.values()));
      }
    });

    socket.on("send_message", (msg: { to: string; text: string }) => {
      const fromUser = users.get(socket.id);
      if (fromUser) {
        const message: Message = {
          id: Math.random().toString(36).substr(2, 9),
          from: fromUser.id,
          to: msg.to,
          text: msg.text,
          timestamp: Date.now(),
        };
        messages.push(message);
        
        // Send to recipient
        const toUser = users.get(msg.to);
        if (toUser) {
          io.to(toUser.socketId).emit("receive_message", message);
        }
        // Send back to sender
        socket.emit("receive_message", message);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      users.delete(socket.id);
      io.emit("users_update", Array.from(users.values()));
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
