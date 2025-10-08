export const str2ab = (s: string) => new TextEncoder().encode(s);
export const ab2str = (ab: ArrayBuffer) => new TextDecoder().decode(ab);
export const buf2b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
export const b642buf = (b64: string) => {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export async function deriveKey(password: string, salt: Uint8Array, iterations = 200000) {
  const pwKey = await crypto.subtle.importKey('raw', str2ab(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithKey(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, str2ab(plaintext));
  return { ivB64: buf2b64(iv.buffer), ctB64: buf2b64(ct) };
}

export async function decryptWithKey(key: CryptoKey, ivB64: string, ctB64: string) {
  const iv = new Uint8Array(b642buf(ivB64));
  const ct = b642buf(ctB64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct).catch(() => null);
  if (!plain) throw new Error('decryption failed');
  return ab2str(plain);
}
