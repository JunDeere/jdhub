const path = require('path');

class Reader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  ensure(length) {
    if (this.offset + length > this.buffer.length) throw new Error('Unexpected end of Notepad state');
  }

  byte() {
    this.ensure(1);
    return this.buffer[this.offset++];
  }

  bytes(length) {
    this.ensure(length);
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  uleb() {
    let value = 0n;
    let shift = 0n;
    while (shift < 70n) {
      const current = this.byte();
      value |= BigInt(current & 0x7f) << shift;
      if ((current & 0x80) === 0) return Number(value);
      shift += 7n;
    }
    throw new Error('Invalid Notepad integer');
  }

  utf16(characterCount) {
    if (!Number.isSafeInteger(characterCount) || characterCount < 0) {
      throw new Error('Invalid Notepad string length');
    }
    return this.bytes(characterCount * 2).toString('utf16le');
  }
}

function readBoolean(reader) {
  const value = reader.byte();
  if (value !== 0 && value !== 1) throw new Error('Invalid Notepad boolean');
  return value === 1;
}

function readConfig(reader) {
  const config = {
    wordWrap: readBoolean(reader),
    rightToLeft: readBoolean(reader),
    showUnicode: readBoolean(reader),
    version: reader.uleb(),
  };
  reader.byte();
  reader.byte();
  if (config.version >= 3) reader.byte();
  return config;
}

function readChunks(reader) {
  const chunks = [];
  while (reader.offset < reader.buffer.length) {
    const position = reader.uleb();
    const deleteCount = reader.uleb();
    const addCount = reader.uleb();
    const text = addCount ? reader.utf16(addCount) : '';
    reader.bytes(4);
    chunks.push({ position, deleteCount, text });
  }
  return chunks;
}

function applyChunks(content, chunks) {
  return chunks.reduce((current, chunk) => {
    const position = Math.min(Math.max(chunk.position, 0), current.length);
    const deleteEnd = Math.min(position + chunk.deleteCount, current.length);
    return `${current.slice(0, position)}${chunk.text}${current.slice(deleteEnd)}`;
  }, content);
}

function parseNotepadState(buffer, filename) {
  const reader = new Reader(buffer);
  if (reader.bytes(2).toString('ascii') !== 'NP') throw new Error('Not a Notepad state file');

  const sequence = reader.uleb();
  const saved = readBoolean(reader);
  const pathLength = reader.uleb();
  let sourcePath = null;
  let modifiedAt = null;

  if (saved) {
    sourcePath = reader.utf16(pathLength);
    reader.uleb();
    reader.byte();
    reader.byte();
    const filetime = reader.uleb();
    modifiedAt = filetime > 116444736000000000
      ? new Date((filetime - 116444736000000000) / 10000)
      : null;
    reader.bytes(32);
    reader.bytes(2);
  }

  const cursorStart = reader.uleb();
  const cursorEnd = reader.uleb();
  const config = readConfig(reader);
  const contentLength = reader.uleb();
  const baseContent = reader.utf16(contentLength);
  const containsUnsavedData = readBoolean(reader);
  reader.bytes(4);
  const chunks = readChunks(reader);
  const content = applyChunks(baseContent, chunks);

  return {
    sourceId: path.basename(filename, '.bin'),
    sourceName: sourcePath ? path.basename(sourcePath) : 'Untitled',
    content,
    saved,
    sourcePath,
    modifiedAt,
    sequence,
    cursorStart,
    cursorEnd,
    config,
    containsUnsavedData,
    chunkCount: chunks.length,
  };
}

module.exports = { parseNotepadState };
