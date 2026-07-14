const express = require('express');
const router = express.Router();
const { insertMessage, getMessages } = require('../db');

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const messages = await getMessages(limit);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, content } = req.body;
    if (!username || !content) {
      return res.status(400).json({ success: false, error: 'username and content are required' });
    }
    const message = await insertMessage(username, content);
    req.io.emit('receive_message', message);
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
