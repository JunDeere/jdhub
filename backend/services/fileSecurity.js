const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BLOCKED_EXTENSIONS = new Set([
  '.app', '.bat', '.cmd', '.com', '.cpl', '.dll', '.dmg', '.exe', '.hta',
  '.ipa', '.lnk', '.msi', '.msp', '.pif', '.ps1', '.scr', '.vbe', '.vbs',
  '.wsf', '.wsh',
]);
const REVIEW_EXTENSIONS = new Set([
  '.apk', '.docm', '.html', '.htm', '.iso', '.jar', '.js', '.jse', '.php',
  '.pptm', '.sh', '.svg', '.xlsm',
]);
const ARCHIVE_EXTENSIONS = new Set(['.7z', '.bz2', '.gz', '.rar', '.tar', '.tgz', '.zip']);

function executableSignature(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return 'Windows executable signature';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return 'Linux executable signature';
  if (buffer.length >= 4) {
    const signature = buffer.readUInt32BE(0);
    if ([0xfeedface, 0xfeedfacf, 0xcafebabe, 0xcefaedfe, 0xcffaedfe].includes(signature)) {
      return 'macOS executable signature';
    }
  }
  return null;
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function inspectUpload(filePath, originalName) {
  const extension = path.extname(String(originalName || '')).toLowerCase();
  const handle = await fs.promises.open(filePath, 'r');
  const header = Buffer.alloc(8192);
  const { bytesRead } = await handle.read(header, 0, header.length, 0);
  await handle.close();
  const signatureFinding = executableSignature(header.subarray(0, bytesRead));

  if (BLOCKED_EXTENSIONS.has(extension) || signatureFinding) {
    return {
      allowed: false,
      sha256: await hashFile(filePath),
      status: 'blocked',
      findings: [signatureFinding || `Blocked executable file type (${extension})`],
    };
  }

  const findings = [];
  if (REVIEW_EXTENSIONS.has(extension)) findings.push(`Active or macro-capable file type (${extension})`);
  if (ARCHIVE_EXTENSIONS.has(extension)) findings.push('Archive contents require deeper antivirus inspection');

  return {
    allowed: true,
    sha256: await hashFile(filePath),
    status: findings.length ? 'review' : 'checked',
    findings,
  };
}

module.exports = {
  inspectUpload,
};
