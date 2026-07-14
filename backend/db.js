const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
});

function insertMessage(username, content) {
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO messages (username, content, status) VALUES (?, ?, 'delivered')`;
    db.run(stmt, [username, content], function (err) {
      if (err) return reject(err);
      db.get(`SELECT * FROM messages WHERE id = ?`, [this.lastID], (err2, row) => {
        if (err2) return reject(err2);
        resolve(row);
      });
    });
  });
}

function getMessages(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM messages ORDER BY id ASC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function updateStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, id], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { db, insertMessage, getMessages, updateStatus };
