// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

const AES_METHOD = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16, checked with php

export function encrypt(text, password) {
  if (process.versions.openssl <= '1.0.1f') {
    throw new Error('OpenSSL Version too old, vulnerability to Heartbleed');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_METHOD, Buffer.from(password), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text, pass) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(pass),
    iv,
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

export const md5 = (contents: string) =>
  crypto.createHash('md5').update(contents).digest('hex');
