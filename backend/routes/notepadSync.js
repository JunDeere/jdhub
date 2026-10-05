const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const NoteSyncSnapshot = require('../models/NoteSyncSnapshot');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SOURCE_ID = /^[0-9a-f-]{16,64}$/i;
const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 1024 * 1024;
const MAX_RAW_BYTES = 6 * 1024 * 1024;

function safeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function cleanTitle(note) {
  const supplied = typeof note.title === 'string' ? note.title.trim() : '';
  const firstLine = String(note.content || '').split(/\r?\n/)[0].trim();
  return (supplied || firstLine || 'Untitled Notepad backup').slice(0, 180);
}

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const [latest, desktopNoteCount] = await Promise.all([
      NoteSyncSnapshot.findOne({ user_id: req.userId })
        .sort({ captured_at: -1 })
        .select('captured_at notepad_version note_count state_hash'),
      Entry.countDocuments({
        user_id: req.userId,
        type: 'life_log',
        'metadata.source': 'windows_notepad',
        archived_at: { $exists: false },
      }),
    ]);

    res.json({
      connected: Boolean(latest),
      latest,
      desktopNoteCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware.notepadBridge, async (req, res) => {
  try {
    const notes = Array.isArray(req.body.notes) ? req.body.notes : [];
    const rawFiles = Array.isArray(req.body.raw_files) ? req.body.raw_files : [];
    const stateHash = String(req.body.state_hash || '').toLowerCase();

    if (!/^[0-9a-f]{64}$/.test(stateHash)) {
      return res.status(400).json({ error: 'A valid state hash is required' });
    }
    if (notes.length > MAX_NOTES) {
      return res.status(400).json({ error: `At most ${MAX_NOTES} notes can be synced at once` });
    }

    const existing = await NoteSyncSnapshot.findOne({ user_id: req.userId, state_hash: stateHash });
    if (existing) {
      return res.json({ synced: false, reason: 'unchanged', capturedAt: existing.captured_at });
    }

    const normalizedNotes = notes.map((note) => {
      const sourceId = String(note.source_id || '');
      const content = typeof note.content === 'string' ? note.content : '';
      if (!SOURCE_ID.test(sourceId)) throw new Error('Invalid Notepad source id');
      if (content.length > MAX_NOTE_LENGTH) throw new Error('A Notepad note is too large to sync');
      return {
        sourceId,
        content,
        title: cleanTitle(note),
        sourceName: String(note.source_name || 'Untitled').slice(0, 260),
        sourceModifiedAt: safeDate(note.modified_at),
      };
    });

    let totalRawBytes = 0;
    const normalizedFiles = rawFiles.map((file) => {
      const name = String(file.name || '');
      if (!/^[0-9a-f-]+(?:\.[01])?\.bin$/i.test(name)) throw new Error('Invalid snapshot filename');
      const data = Buffer.from(String(file.data_base64 || ''), 'base64');
      totalRawBytes += data.length;
      return { name, modified_at: safeDate(file.modified_at), data };
    });
    if (totalRawBytes > MAX_RAW_BYTES) throw new Error('Notepad snapshot is too large to sync');

    const capturedAt = safeDate(req.body.captured_at);
    await NoteSyncSnapshot.create({
      user_id: req.userId,
      state_hash: stateHash,
      captured_at: capturedAt,
      notepad_version: String(req.body.notepad_version || 'unknown').slice(0, 80),
      note_count: normalizedNotes.length,
      files: normalizedFiles,
    });

    await Promise.all(normalizedNotes.map((note) => Entry.findOneAndUpdate(
      {
        user_id: new mongoose.Types.ObjectId(req.userId),
        type: 'life_log',
        'metadata.source': 'windows_notepad',
        'metadata.notepad_source_id': note.sourceId,
      },
      {
        $set: {
          title: note.title,
          content: note.content,
          category: 'Desktop backup',
          tags: ['notes', 'windows-notepad', 'backup'],
          metadata: {
            source: 'windows_notepad',
            notepad_source_id: note.sourceId,
            source_name: note.sourceName,
            desktop_read_only: true,
            synced_at: capturedAt,
            source_modified_at: note.sourceModifiedAt,
          },
        },
        $unset: { archived_at: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )));

    res.status(201).json({ synced: true, noteCount: normalizedNotes.length, capturedAt });
  } catch (error) {
    const status = error?.code === 11000 ? 200 : 400;
    res.status(status).json(error?.code === 11000
      ? { synced: false, reason: 'unchanged' }
      : { error: error.message });
  }
});

module.exports = router;
