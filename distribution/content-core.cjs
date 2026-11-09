'use strict';
// Independent distribution primitive. Not connected to the public Unified runtime.
// NEVER place signing private keys or decryption keys in a client build.
const crypto = require('node:crypto');
const SCHEMA = 'unified-content/v1';
const DOMAIN = Buffer.from('UNIFIED-CONTENT-MANIFEST-V1\0', 'utf8');
const HEADER = Buffer.from('UGCM1');
const SHA = /^[a-f0-9]{64}$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function assertKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(label + ' must be an object');
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) throw Error('Unexpected or missing keys in ' + label);
}
function safePath(value) {
  if (typeof value !== 'string' || !value || value.length > 512 || value !== value.normalize('NFC') ||
    value.startsWith('/') || value.includes('\\') || /[<>:"|?*\u0000-\u001f]/.test(value)) {
    throw Error('Unsafe asset path');
  }
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.length > 255 ||
    /[. ]$/.test(p) || WIN_RESERVED.test(p))) throw Error('Unsafe asset path');
  return value;
}
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function canonical(manifest) {
  assertKeys(manifest, ['schema', 'product', 'version', 'sequence', 'keyId', 'encryptionKeyId', 'files'], 'manifest');
  if (manifest.schema !== SCHEMA || manifest.product !== 'unified' || !SEMVER.test(manifest.version) ||
    !Number.isSafeInteger(manifest.sequence) || manifest.sequence < 1 ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(manifest.keyId) ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(manifest.encryptionKeyId) ||
    !Array.isArray(manifest.files) || manifest.files.length > 100000) throw Error('Invalid manifest metadata');
  let previous = '', previousFolded = '';
  const folded = new Set();
  for (const file of manifest.files) {
    assertKeys(file, ['path', 'sha256', 'objectSha256', 'bytes', 'encrypted'], 'file');
    safePath(file.path);
    if (!SHA.test(file.sha256) || !SHA.test(file.objectSha256) ||
      !Number.isSafeInteger(file.bytes) || file.bytes < 0 ||
      file.encrypted !== true) throw Error('Invalid encrypted file descriptor');
    // Cross-platform safety: one path must not shadow another on Windows.
    const lower = file.path.toLowerCase();
    if (previous && file.path <= previous) throw Error('Files must be sorted and unique');
    if (folded.has(lower)) throw Error('Case-insensitive file collision');
    folded.add(lower); previous = file.path; previousFolded = lower;
  }
  return JSON.stringify(manifest);
}
function signatureBytes(manifest) { return Buffer.concat([DOMAIN, Buffer.from(canonical(manifest), 'utf8')]); }
function signManifest(manifest, privateKey) {
  const signature = crypto.sign(null, signatureBytes(manifest), privateKey).toString('base64');
  return {manifest, signature};
}
function verifyRelease(envelope, publicKeys, minimumSequence = 0) {
  assertKeys(envelope, ['manifest', 'signature'], 'release envelope');
  const manifest = envelope.manifest;
  const bytes = signatureBytes(manifest);
  if (!Number.isSafeInteger(minimumSequence) || minimumSequence < 0 ||
    manifest.sequence < minimumSequence) throw Error('Release rollback detected');
  const pub = publicKeys instanceof Map ? publicKeys.get(manifest.keyId) : publicKeys?.[manifest.keyId];
  if (!pub) throw Error('Unknown signing key');
  if (typeof envelope.signature !== 'string' ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) throw Error('Malformed release signature');
  const raw = Buffer.from(envelope.signature, 'base64');
  if (raw.length !== 64 || raw.toString('base64') !== envelope.signature ||
    !crypto.verify(null, bytes, pub, raw)) throw Error('Release signature mismatch');
  return manifest;
}
function requireKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw Error('AES-256-GCM requires a 32-byte secret provided at runtime');
}
function encryptAsset(plaintext, key) {
  requireKey(key);
  if (!Buffer.isBuffer(plaintext)) throw TypeError('plaintext must be a Buffer');
  const digest = hash(plaintext), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('UNIFIED-ASSET-V1\0' + digest, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const blob = Buffer.concat([HEADER, iv, cipher.getAuthTag(), ciphertext]);
  return {blob, sha256:digest, objectSha256:hash(blob), bytes:plaintext.length, encrypted:true};
}
function decryptAsset(blob, descriptor, key) {
  assertKeys(descriptor, ['path', 'sha256', 'objectSha256', 'bytes', 'encrypted'], 'file');
  safePath(descriptor.path);
  if (!SHA.test(descriptor.sha256) || !SHA.test(descriptor.objectSha256) ||
    !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 0 || descriptor.encrypted !== true)
    throw Error('Invalid file descriptor');
  if (!Buffer.isBuffer(blob) || hash(blob) !== descriptor.objectSha256) throw Error('Downloaded object hash mismatch');
  requireKey(key);
  if (blob.length < 33 || !blob.subarray(0, 5).equals(HEADER)) throw Error('Invalid encrypted object');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(5, 17));
  decipher.setAAD(Buffer.from('UNIFIED-ASSET-V1\0' + descriptor.sha256, 'utf8'));
  decipher.setAuthTag(blob.subarray(17, 33));
  const plaintext = Buffer.concat([decipher.update(blob.subarray(33)), decipher.final()]);
  if (plaintext.length !== descriptor.bytes || hash(plaintext) !== descriptor.sha256)
    throw Error('Decrypted file integrity mismatch');
  return plaintext;
}
function planUpdate(previous, target, cachedObjectHashes = []) {
  canonical(target);
  if (previous) {
    canonical(previous);
    if (previous.product !== target.product || previous.encryptionKeyId !== target.encryptionKeyId)
      throw Error('Product or encryption key lineage changed; explicit migration required');
    if (target.sequence < previous.sequence) throw Error('Release rollback detected');
    if (target.sequence === previous.sequence && canonical(target) !== canonical(previous))
      throw Error('Two releases have the same sequence');
  }
  const old = new Map((previous?.files || []).map(f => [f.path, f]));
  const next = new Set(target.files.map(f => f.path));
  const cached = new Set(cachedObjectHashes);
  const download = [], retain = [];
  for (const file of target.files) {
    const before = old.get(file.path);
    if (before?.objectSha256 === file.objectSha256 ||
      cached.has(file.objectSha256)) retain.push(file);
    else download.push(file);
  }
  const remove = [...old.keys()].filter(p => !next.has(p)).sort();
  return {download, retain, remove, countToDownload:download.length,
    totalUnpackedBytes:target.files.reduce((n,f)=>n+f.bytes,0)};
}
function objectPath(objectSha256) {
  if (!SHA.test(objectSha256)) throw Error('Invalid object digest');
  return 'objects/' + objectSha256.slice(0, 2) + '/' + objectSha256 + '.bin';
}
module.exports = {SCHEMA, safePath, hash, canonical, signManifest, verifyRelease,
  encryptAsset, decryptAsset, planUpdate, objectPath};
