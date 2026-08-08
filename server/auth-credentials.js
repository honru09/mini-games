'use strict';

// Username/password credential primitives for Ghost Game.
// This module deliberately owns no persistence, sessions, logging, or transport.
const crypto = require('crypto');

const USERNAME_MIN_LENGTH = 4;
const USERNAME_MAX_LENGTH = 20;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;
const PASSWORD_HASH_VERSION = 's3';

const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_OPTIONS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
const USERNAME_HAS_LETTER = /[A-Za-z]/;
const USERNAME_HAS_DIGIT = /[0-9]/;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/;
const HASH_PATTERN = /^s3\$(16384)\$(8)\$(1)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;

// A stable, non-secret salt is intentional here: the dummy path exists only to
// spend the same KDF work for an absent user or malformed stored credential.
const DUMMY_SALT = crypto.createHash('sha256')
  .update('ghost-game-auth-s3-dummy-user')
  .digest()
  .subarray(0, SCRYPT_SALT_LENGTH);
const DUMMY_EXPECTED = Buffer.alloc(SCRYPT_KEY_LENGTH, 0xa5);
const DUMMY_PASSWORD = 'dummy-passphrase-s3';

function normalizeUsername(username){
  return typeof username === 'string' ? username.toLowerCase() : '';
}

function validateUsername(username){
  const normalized = normalizeUsername(username);
  const valid = typeof username === 'string' &&
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username) &&
    USERNAME_HAS_LETTER.test(username) &&
    USERNAME_HAS_DIGIT.test(username);
  return Object.freeze({ valid, normalized, reason: valid ? '' : 'username_invalid' });
}

function isValidUsername(username){
  return validateUsername(username).valid;
}

function validatePassword(password){
  const valid = typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PRINTABLE_ASCII_PATTERN.test(password);
  // Never return the submitted password, a transformed password, or its length.
  return Object.freeze({ valid, reason: valid ? '' : 'password_invalid' });
}

function isValidPassword(password){
  return validatePassword(password).valid;
}

function scryptAsync(password, salt, options){
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function encodePasswordHash(salt, derivedKey){
  return [
    PASSWORD_HASH_VERSION,
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

function parsePasswordHash(storedHash){
  if (typeof storedHash !== 'string') return null;
  const match = HASH_PATTERN.exec(storedHash);
  if (!match) return null;

  const salt = Buffer.from(match[4], 'base64url');
  const expected = Buffer.from(match[5], 'base64url');
  if (salt.length !== SCRYPT_SALT_LENGTH || expected.length !== SCRYPT_KEY_LENGTH) return null;
  return { salt, expected, options: SCRYPT_OPTIONS };
}

function isPasswordHash(storedHash){
  return parsePasswordHash(storedHash) !== null;
}

async function hashPassword(password){
  if (!isValidPassword(password)) {
    const error = new TypeError('password_invalid');
    error.code = 'password_invalid';
    throw error;
  }
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_OPTIONS);
  return encodePasswordHash(salt, derivedKey);
}

async function verifyPassword(password, storedHash){
  const passwordValid = isValidPassword(password);
  const parsed = parsePasswordHash(storedHash);
  const material = passwordValid ? password : DUMMY_PASSWORD;
  const salt = parsed ? parsed.salt : DUMMY_SALT;
  const expected = parsed ? parsed.expected : DUMMY_EXPECTED;
  const actual = await scryptAsync(material, salt, parsed ? parsed.options : SCRYPT_OPTIONS);
  const matches = crypto.timingSafeEqual(actual, expected);
  return Boolean(passwordValid && parsed && matches);
}

module.exports = Object.freeze({
  PASSWORD_HASH_VERSION,
  normalizeUsername,
  validateUsername,
  isValidUsername,
  validatePassword,
  isValidPassword,
  isPasswordHash,
  hashPassword,
  verifyPassword,
});
