const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DIARY_KDF_ITERATIONS = 600_000;

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return window.btoa(binary);
}

function base64ToBytes(value) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveWrappingKey(password, salt, iterations) {
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

export async function createDiaryKeyMaterial(password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const wrappedKeyIv = window.crypto.getRandomValues(new Uint8Array(12));
  const diaryKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const wrappingKey = await deriveWrappingKey(password, salt, DIARY_KDF_ITERATIONS);
  const wrappedKey = await window.crypto.subtle.wrapKey(
    'raw',
    diaryKey,
    wrappingKey,
    { name: 'AES-GCM', iv: wrappedKeyIv },
  );

  return {
    diaryKey,
    vault: {
      version: 1,
      kdf_salt: bytesToBase64(salt),
      kdf_iterations: DIARY_KDF_ITERATIONS,
      wrapped_key: bytesToBase64(wrappedKey),
      wrapped_key_iv: bytesToBase64(wrappedKeyIv),
    },
  };
}

export async function unlockDiaryKey(password, vault) {
  const wrappingKey = await deriveWrappingKey(
    password,
    base64ToBytes(vault.kdf_salt),
    vault.kdf_iterations,
  );

  return window.crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(vault.wrapped_key),
    wrappingKey,
    { name: 'AES-GCM', iv: base64ToBytes(vault.wrapped_key_iv) },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptDiaryPayload(diaryKey, payload) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    diaryKey,
    encoder.encode(JSON.stringify(payload)),
  );

  return { version: 1, ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

export async function decryptDiaryPayload(diaryKey, entry) {
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(entry.iv) },
    diaryKey,
    base64ToBytes(entry.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext));
}
