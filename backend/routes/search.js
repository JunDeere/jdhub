const express = require('express');
const authMiddleware = require('../middleware/auth');
const { unifiedSearch } = require('../services/unifiedSearch');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) return res.status(400).json({ error: 'Search query is required' });

    const data = await unifiedSearch(req.userId, query, { limit: req.query.limit });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
