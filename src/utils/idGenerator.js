const { customAlphabet } = require('nanoid');

// Uppercase alphanumeric, excluding visually ambiguous characters (0/O, 1/I/L).
// 8 characters from this 32-symbol alphabet gives ~1.1 x 10^12 combinations,
// short enough to print legibly under a CODE128 barcode.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nanoid = customAlphabet(ALPHABET, 8);

function generateId() {
  return nanoid();
}

module.exports = { generateId };
