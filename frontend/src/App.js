import React, { useEffect, useRef, useState } from 'react';
import { socket } from './socket';
import './App.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function formatTime(ts) {
  const date = new Date(ts.includes('Z') || ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [username, setUsername] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const typingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('chat_username');
    if (stored) {
      setUsername(stored);
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    fetch(`${SERVER_URL}/api/messages`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setMessages(json.data);
      })
      .catch(() => {});

    socket.connect();
    socket.emit('user_online', username);

    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    socket.on('typing', ({ username: typer, isTyping }) => {
      if (typer === username) return;
      setTypingUser(isTyping ? typer : null);
    });

    socket.on('message_status_update', ({ id, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
    });

    return () => {
      socket.off('receive_message');
      socket.off('online_users');
      socket.off('typing');
      socket.off('message_status_update');
      socket.disconnect();
    };
  }, [loggedIn, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    localStorage.setItem('chat_username', username.trim());
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_username');
    setLoggedIn(false);
    setUsername('');
    setMessages([]);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit('send_message', { username, content: draft.trim() });
    socket.emit('typing', { username, isTyping: false });
    setDraft('');
  };

  const handleTyping = (value) => {
    setDraft(value);
    socket.emit('typing', { username, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { username, isTyping: false });
    }, 1200);
  };

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>Realtime Chat</h1>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit">Join Chat</button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <div>
          <h2>Realtime Chat</h2>
          <span className="online-count">{onlineUsers.length} online</span>
        </div>
        <div className="user-info">
          <span>{username}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-bubble ${msg.username === username ? 'own' : 'other'}`}
          >
            <div className="message-meta">
              <span className="message-user">{msg.username}</span>
              <span className="message-time">{formatTime(msg.created_at)}</span>
            </div>
            <div className="message-content">{msg.content}</div>
            {msg.username === username && (
              <div className="message-status">{msg.status}</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {typingUser && <div className="typing-indicator">{typingUser} is typing...</div>}

      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={draft}
          onChange={(e) => handleTyping(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
