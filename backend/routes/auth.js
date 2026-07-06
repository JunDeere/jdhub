const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

function serializeUser(user) {
  return { id: user._id, email: user.email, name: user.name, phone: user.phone };
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password_hash: hashed, name });
    const token = createToken(user);

    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const legacyUser = await User.collection.findOne({ _id: user._id });
    const storedPasswordHash = user.password_hash || legacyUser?.password;
    const valid = storedPasswordHash && await bcrypt.compare(password, storedPasswordHash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    if (!user.password_hash && legacyUser?.password) {
      user.password_hash = legacyUser.password;
      await user.save();
      await User.collection.updateOne({ _id: user._id }, { $unset: { password: '' } });
    }

    const token = createToken(user);
    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.name = typeof name === 'string' ? name.trim() : user.name;
    user.phone = typeof phone === 'string' ? phone.trim() : user.phone;
    await user.save();

    res.json({ user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
