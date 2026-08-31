/**
 * Buffer utilities for efficient PDF reading
 * Uses Uint8Array and subarray for zero-copy operations
 */

import type { Cursor } from "./types.js";

// ============================================================================
// Character codes for fast comparison
// ============================================================================

// Whitespace characters
export const SPACE = 0x20; // ' '
export const TAB = 0x09; // '\t'
export const LF = 0x0a; // '\n'
export const FF = 0x0c; // '\f'
export const CR = 0x0d; // '\r'
export const NULL = 0x00; // '\0'

// Delimiter characters
export const LPAREN = 0x28; // '('
export const RPAREN = 0x29; // ')'
export const LANGLE = 0x3c; // '<'
export const RANGLE = 0x3e; // '>'
export const LBRACKET = 0x5b; // '['
export const RBRACKET = 0x5d; // ']'
export const LBRACE = 0x7b; // '{'
export const RBRACE = 0x7d; // '}'
export const SLASH = 0x2f; // '/'
export const PERCENT = 0x25; // '%'

// Numeric characters
export const PLUS = 0x2b; // '+'
export const MINUS = 0x2d; // '-'
export const DOT = 0x2e; // '.'
export const ZERO = 0x30; // '0'
export const NINE = 0x39; // '9'

// Hex characters
export const A_UPPER = 0x41; // 'A'
export const F_UPPER = 0x46; // 'F'
export const A_LOWER = 0x61; // 'a'
export const F_LOWER = 0x66; // 'f'

// Other characters
export const BACKSLASH = 0x5c; // '\\'
export const HASH = 0x23; // '#'

// ============================================================================
// PDF Keywords as byte arrays for fast comparison
// ============================================================================

export const KEYWORD_TRUE = new Uint8Array([0x74, 0x72, 0x75, 0x65]); // "true"
export const KEYWORD_FALSE = new Uint8Array([0x66, 0x61, 0x6c, 0x73, 0x65]); // "false"
export const KEYWORD_NULL = new Uint8Array([0x6e, 0x75, 0x6c, 0x6c]); // "null"
export const KEYWORD_OBJ = new Uint8Array([0x6f, 0x62, 0x6a]); // "obj"
export const KEYWORD_ENDOBJ = new Uint8Array([0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a]); // "endobj"
export const KEYWORD_STREAM = new Uint8Array([0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]); // "stream"
export const KEYWORD_ENDSTREAM = new Uint8Array([
  0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d,
]); // "endstream"
export const KEYWORD_XREF = new Uint8Array([0x78, 0x72, 0x65, 0x66]); // "xref"
export const KEYWORD_TRAILER = new Uint8Array([0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72]); // "trailer"
export const KEYWORD_STARTXREF = new Uint8Array([
  0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66,
]); // "startxref"
export const KEYWORD_R = new Uint8Array([0x52]); // "R"
export const KEYWORD_N = new Uint8Array([0x6e]); // "n"
export const KEYWORD_F = new Uint8Array([0x66]); // "f"

export const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
export const EOF_MARKER = new Uint8Array([0x25, 0x25, 0x45, 0x4f, 0x46]); // "%%EOF"

// ============================================================================
// Cursor Functions
// ============================================================================

/**
 * Create a new cursor for reading
 */
export function createCursor(buffer: Uint8Array, position: number = 0): Cursor {
  return { buffer, position };
}

/**
 * Check if cursor has more bytes to read
 */
export function hasMore(cursor: Cursor): boolean {
  return cursor.position < cursor.buffer.length;
}

/**
 * Check if cursor has at least n bytes to read
 */
export function hasBytes(cursor: Cursor, n: number): boolean {
  return cursor.position + n <= cursor.buffer.length;
}

/**
 * Get current byte without advancing
 */
export function peek(cursor: Cursor): number {
  return cursor.buffer[cursor.position] ?? -1;
}

/**
 * Get multiple bytes without advancing (returns subarray view)
 */
export function peekBytes(cursor: Cursor, count: number): Uint8Array {
  return cursor.buffer.subarray(cursor.position, cursor.position + count);
}

/**
 * Get current byte and advance cursor
 */
export function read(cursor: Cursor): number {
  return cursor.buffer[cursor.position++] ?? -1;
}

/**
 * Advance cursor by n bytes
 */
export function advance(cursor: Cursor, n: number = 1): void {
  cursor.position += n;
}

/**
 * Move cursor to absolute position
 */
export function seek(cursor: Cursor, position: number): void {
  cursor.position = position;
}

/**
 * Get remaining bytes as subarray view
 */
export function remaining(cursor: Cursor): Uint8Array {
  return cursor.buffer.subarray(cursor.position);
}

/**
 * Get subarray from current position
 */
export function slice(cursor: Cursor, start: number, end: number): Uint8Array {
  return cursor.buffer.subarray(cursor.position + start, cursor.position + end);
}

// ============================================================================
// Character Classification
// ============================================================================

/**
 * Check if byte is whitespace
 */
export function isWhitespace(byte: number): boolean {
  return (
    byte === SPACE || byte === TAB || byte === LF || byte === CR || byte === FF || byte === NULL
  );
}

/**
 * Check if byte is end of line
 */
export function isEOL(byte: number): boolean {
  return byte === LF || byte === CR;
}

/**
 * Check if byte is a digit
 */
export function isDigit(byte: number): boolean {
  return byte >= ZERO && byte <= NINE;
}

/**
 * Check if byte is a hex digit
 */
export function isHexDigit(byte: number): boolean {
  return (
    (byte >= ZERO && byte <= NINE) ||
    (byte >= A_UPPER && byte <= F_UPPER) ||
    (byte >= A_LOWER && byte <= F_LOWER)
  );
}

/**
 * Check if byte is a delimiter
 */
export function isDelimiter(byte: number): boolean {
  return (
    byte === LPAREN ||
    byte === RPAREN ||
    byte === LANGLE ||
    byte === RANGLE ||
    byte === LBRACKET ||
    byte === RBRACKET ||
    byte === LBRACE ||
    byte === RBRACE ||
    byte === SLASH ||
    byte === PERCENT
  );
}

/**
 * Check if byte can start a number
 */
export function isNumberStart(byte: number): boolean {
  return isDigit(byte) || byte === PLUS || byte === MINUS || byte === DOT;
}

// ============================================================================
// Byte Matching
// ============================================================================

/**
 * Check if buffer at offset matches pattern
 */
export function matchBytes(buffer: Uint8Array, offset: number, pattern: Uint8Array): boolean {
  if (offset + pattern.length > buffer.length) {
    return false;
  }
  for (let i = 0; i < pattern.length; i++) {
    if (buffer[offset + i] !== pattern[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if cursor position matches pattern
 */
export function matchPattern(cursor: Cursor, pattern: Uint8Array): boolean {
  return matchBytes(cursor.buffer, cursor.position, pattern);
}

/**
 * Skip whitespace characters
 */
export function skipWhitespace(cursor: Cursor): void {
  while (cursor.position < cursor.buffer.length) {
    const byte = cursor.buffer[cursor.position];
    if (byte !== undefined && isWhitespace(byte)) {
      cursor.position++;
    } else {
      break;
    }
  }
}

/**
 * Skip to end of line
 */
export function skipLine(cursor: Cursor): void {
  while (cursor.position < cursor.buffer.length) {
    const byte = cursor.buffer[cursor.position];
    cursor.position++;
    if (byte === LF) {
      break;
    }
    if (byte === CR) {
      // Handle CRLF
      if (cursor.buffer[cursor.position] === LF) {
        cursor.position++;
      }
      break;
    }
  }
}

/**
 * Skip comment (from % to end of line)
 */
export function skipComment(cursor: Cursor): void {
  if (cursor.buffer[cursor.position] === PERCENT) {
    skipLine(cursor);
  }
}

/**
 * Skip whitespace and comments
 */
export function skipWhitespaceAndComments(cursor: Cursor): void {
  while (cursor.position < cursor.buffer.length) {
    const byte = cursor.buffer[cursor.position];
    if (byte !== undefined && isWhitespace(byte)) {
      cursor.position++;
    } else if (byte === PERCENT) {
      skipComment(cursor);
    } else {
      break;
    }
  }
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Find pattern in buffer starting from offset
 * Returns -1 if not found
 */
export function findPattern(
  buffer: Uint8Array,
  pattern: Uint8Array,
  startOffset: number = 0,
): number {
  const maxOffset = buffer.length - pattern.length;
  for (let i = startOffset; i <= maxOffset; i++) {
    if (matchBytes(buffer, i, pattern)) {
      return i;
    }
  }
  return -1;
}

/**
 * Find pattern in buffer searching backwards from offset
 * Returns -1 if not found
 */
export function findPatternBackward(
  buffer: Uint8Array,
  pattern: Uint8Array,
  startOffset?: number,
): number {
  const start = startOffset ?? buffer.length - pattern.length;
  for (let i = start; i >= 0; i--) {
    if (matchBytes(buffer, i, pattern)) {
      return i;
    }
  }
  return -1;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert byte to hex digit value
 */
export function hexValue(byte: number): number {
  if (byte >= ZERO && byte <= NINE) {
    return byte - ZERO;
  }
  if (byte >= A_UPPER && byte <= F_UPPER) {
    return byte - A_UPPER + 10;
  }
  if (byte >= A_LOWER && byte <= F_LOWER) {
    return byte - A_LOWER + 10;
  }
  return -1;
}

/**
 * Convert bytes to string using Latin-1 encoding
 */
export function bytesToString(bytes: Uint8Array): string {
  // TextDecoder('latin1') is specified as Windows-1252 by WHATWG, so bytes
  // 0x80..0x9f do not round-trip. PDF names are byte strings and must retain
  // their original values for later #XX/UTF-16 decoding.
  let result = "";
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, bytes.length);
    const chars: number[] = [];
    for (let i = start; i < end; i++) {
      chars.push(bytes[i] ?? 0);
    }
    result += String.fromCharCode(...chars);
  }
  return result;
}

/**
 * Parse integer from bytes
 */
export function parseInteger(buffer: Uint8Array, start: number, end: number): number {
  let value = 0;
  let negative = false;
  let i = start;

  if (buffer[i] === MINUS) {
    negative = true;
    i++;
  } else if (buffer[i] === PLUS) {
    i++;
  }

  while (i < end) {
    const byte = buffer[i];
    if (byte !== undefined && byte >= ZERO && byte <= NINE) {
      value = value * 10 + (byte - ZERO);
    }
    i++;
  }

  return negative ? -value : value;
}

/**
 * Parse float from bytes
 */
export function parseFloatFromBytes(buffer: Uint8Array, start: number, end: number): number {
  // Use native parseFloat for simplicity - V8 optimizes this well
  return Number.parseFloat(bytesToString(buffer.subarray(start, end)));
}
