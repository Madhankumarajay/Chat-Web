require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const messagesRouter = require('./routes/messages');
const { insertMessage, updateStatus } = require('./db');

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/messages', messagesRouter);

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('user_online', (username) => {
    if (!username) return;
    onlineUsers.set(socket.id, username);
    io.emit('online_users', Array.from(new Set(onlineUsers.values())));
  });

  socket.on('send_message', async ({ username, content }) => {
    if (!username || !content) return;
    try {
      const message = await insertMessage(username, content);
      io.emit('receive_message', message);
    } catch (err) {
      socket.emit('error_message', { error: 'Failed to save message' });
    }
  });

  socket.on('message_read', async ({ id }) => {
    try {
      await updateStatus(id, 'read');
      io.emit('message_status_update', { id, status: 'read' });
    } catch (err) {
      socket.emit('error_message', { error: 'Failed to update status' });
    }
  });

  socket.on('typing', ({ username, isTyping }) => {
    socket.broadcast.emit('typing', { username, isTyping });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users', Array.from(new Set(onlineUsers.values())));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
