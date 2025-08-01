const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const session = require('express-session');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// In-memory storage (Better to replace with an actual database like postgres)
const rooms = new Map(); // roomId -> { name, messages: [], users: Set }
const userSockets = new Map(); // userId -> socketId
const socketUsers = new Map(); // socketId -> user

// Google OAuth Strategy for authentication
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails[0].value,
    picture: profile.photos[0].value
  };
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Socket.IO authentication middleware
const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret', (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
};

// Auth routes
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      req.user,
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' }
    );
    
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

app.post('/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// API routes
app.get('/api/rooms', authenticateToken, (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    userCount: room.users.size,
    users: Array.from(room.users)
  }));
  res.json(roomList);
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  rooms.set(roomId, {
    name: name.trim(),
    messages: [],
    users: new Set()
  });

  res.json({ id: roomId, name: name.trim() });
});

app.get('/api/rooms/:id/messages', authenticateToken, (req, res) => {
  const { id } = req.params;
  const room = rooms.get(id);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json(room.messages);
});

// Socket.IO connection handling
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`User ${socket.user.name} connected`);
  
  userSockets.set(socket.user.id, socket.id);
  socketUsers.set(socket.id, socket.user);

  // Join room
  socket.on('join_room', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    // Leave previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
        const prevRoom = rooms.get(room);
        if (prevRoom) {
          prevRoom.users.delete(socket.user);
          socket.to(room).emit('user_left', {
            user: socket.user,
            users: Array.from(prevRoom.users)
          });
        }
      }
    });

    // Join new room
    socket.join(roomId);
    room.users.add(socket.user);
    
    // Notify room about new user
    socket.to(roomId).emit('user_joined', {
      user: socket.user,
      users: Array.from(room.users)
    });

    // Send current room users to the joining user
    socket.emit('room_users', {
      roomId,
      users: Array.from(room.users)
    });

    // Send message history
    socket.emit('message_history', {
      roomId,
      messages: room.messages
    });

    console.log(`${socket.user.name} joined room ${roomId}`);
  });

  // Send message
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (!room.users.has(socket.user)) {
      socket.emit('error', 'You are not in this room');
      return;
    }

    const messageObj = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user: socket.user,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    // Store message
    room.messages.push(messageObj);
    
    // Keep only last 100 messages per room
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    // Broadcast to room
    io.to(roomId).emit('message', messageObj);
    console.log(`Message from ${socket.user.name} in ${roomId}: ${message}`);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user_typing', {
      user: socket.user,
      isTyping: data.isTyping
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.name} disconnected`);
    
    // Remove from all rooms
    Array.from(socket.rooms).forEach(roomId => {
      if (roomId !== socket.id) {
        const room = rooms.get(roomId);
        if (room) {
          room.users.delete(socket.user);
          socket.to(roomId).emit('user_left', {
            user: socket.user,
            users: Array.from(room.users)
          });
        }
      }
    });

    userSockets.delete(socket.user.id);
    socketUsers.delete(socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
});

module.exports = { app, server, io };