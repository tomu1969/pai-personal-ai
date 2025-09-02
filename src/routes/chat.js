const express = require('express');
const {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  updateConversation,
  searchMessages,
  getConversationStats,
} = require('../controllers/chat');

const router = express.Router();

// Conversation management routes
router.get('/', getConversations);
router.get('/stats', getConversationStats);
router.get('/search', searchMessages);

// Individual conversation routes
router.get('/:id', getConversationMessages);
router.post('/:id/messages', sendMessage);
router.patch('/:id/read', markConversationAsRead);
router.patch('/:id', updateConversation);

module.exports = router;
