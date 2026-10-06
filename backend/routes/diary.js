const express = require('express');
const DiaryEntry = require('../models/DiaryEntry');
const DiaryVault = require('../models/DiaryVault');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function encryptedValue(value, label, maxLength) {
  if (typeof value !== 'string' || !value || value.length > maxLength || !BASE64_PATTERN.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function entryPayload(body) {
  return {
    version: body.version === 1 ? 1 : 1,
    ciphertext: encryptedValue(body.ciphertext, 'Encrypted diary content', 5_500_000),
    iv: encryptedValue(body.iv, 'Encryption IV', 128),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [vault, entries] = await Promise.all([
      DiaryVault.findOne({ user_id: req.userId }).lean(),
      DiaryEntry.find({ user_id: req.userId }).sort({ updatedAt: -1 }).limit(500).lean(),
    ]);

    res.json({ vault, entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vault', async (req, res) => {
  try {
    const existingVault = await DiaryVault.exists({ user_id: req.userId });
    if (existingVault) return res.status(409).json({ error: 'Diary vault already exists' });

    const iterations = Number(req.body.kdf_iterations);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
      return res.status(400).json({ error: 'Diary key settings are invalid' });
    }

    const vault = await DiaryVault.create({
      user_id: req.userId,
      version: 1,
      algorithm: 'PBKDF2-SHA256/AES-256-GCM',
      kdf_salt: encryptedValue(req.body.kdf_salt, 'Key salt', 256),
      kdf_iterations: iterations,
      wrapped_key: encryptedValue(req.body.wrapped_key, 'Wrapped diary key', 512),
      wrapped_key_iv: encryptedValue(req.body.wrapped_key_iv, 'Wrapped key IV', 128),
      memory_prompts_enabled: req.body.memory_prompts_enabled !== false,
    });

    res.status(201).json({ vault });
  } catch (error) {
    res.status(error.message.endsWith('is invalid') ? 400 : 500).json({ error: error.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    if (typeof req.body.memory_prompts_enabled !== 'boolean') {
      return res.status(400).json({ error: 'Memory prompt preference is required' });
    }

    const vault = await DiaryVault.findOneAndUpdate(
      { user_id: req.userId },
      { memory_prompts_enabled: req.body.memory_prompts_enabled },
      { returnDocument: 'after' },
    );

    if (!vault) return res.status(404).json({ error: 'Diary vault not found' });
    res.json({ vault });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/entries', async (req, res) => {
  try {
    const vaultExists = await DiaryVault.exists({ user_id: req.userId });
    if (!vaultExists) return res.status(409).json({ error: 'Set up the diary vault first' });

    const entry = await DiaryEntry.create({
      ...entryPayload(req.body),
      user_id: req.userId,
    });

    res.status(201).json({ entry });
  } catch (error) {
    res.status(error.message.endsWith('is invalid') ? 400 : 500).json({ error: error.message });
  }
});

router.patch('/entries/:id', async (req, res) => {
  try {
    const entry = await DiaryEntry.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      entryPayload(req.body),
      { returnDocument: 'after' },
    );

    if (!entry) return res.status(404).json({ error: 'Diary entry not found' });
    res.json({ entry });
  } catch (error) {
    res.status(error.message.endsWith('is invalid') ? 400 : 500).json({ error: error.message });
  }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await DiaryEntry.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!entry) return res.status(404).json({ error: 'Diary entry not found' });
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
