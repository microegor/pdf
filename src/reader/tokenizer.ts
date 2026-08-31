/**
 * PDF Tokenizer
 * Converts byte stream into tokens for parsing
 */

import {
  advance,
  BACKSLASH,
  bytesToString,
  DOT,
  HASH,
  hasMore,
  hexValue,
  isDelimiter,
  isDigit,
  isHexDigit,
  isNumberStart,
  isWhitespace,
  KEYWORD_ENDOBJ,
  KEYWORD_ENDSTREAM,
  KEYWORD_F,
  KEYWORD_FALSE,
  KEYWORD_N,
  KEYWORD_NULL,
  KEYWORD_OBJ,
  KEYWORD_R,
  KEYWORD_STARTXREF,
  KEYWORD_STREAM,
  KEYWORD_TRAILER,
  KEYWORD_TRUE,
  KEYWORD_XREF,
  LANGLE,
  LBRACKET,
  LPAREN,
  MINUS,
  matchPattern,
  PLUS,
  peek,
  RANGLE,
  RBRACKET,
  RPAREN,
  read,
  SLASH,
  skipWhitespaceAndComments,
} from "./buffer.js";
import type { Cursor, Token, TokenType } from "./types.js";

// ============================================================================
// Token Creation
// ============================================================================

function createToken(type: TokenType, start: number, end: number, value?: string | number): Token {
  if (value !== undefined) {
    return { type, start, end, value };
  }
  return { type, start, end };
}

// ============================================================================
// Tokenizer Functions
// ============================================================================

/**
 * Read the next token from cursor
 * Returns null if end of buffer is reached
 */
export function nextToken(cursor: Cursor, maxNameBytes: number = Infinity): Token | null {
  skipWhitespaceAndComments(cursor);

  if (!hasMore(cursor)) {
    return createToken("eof", cursor.position, cursor.position);
  }

  const byte = peek(cursor);
  const start = cursor.position;

  // Dictionary start <<
  if (byte === LANGLE && cursor.buffer[cursor.position + 1] === LANGLE) {
    advance(cursor, 2);
    return createToken("dict_start", start, cursor.position);
  }

  // Dictionary end >>
  if (byte === RANGLE && cursor.buffer[cursor.position + 1] === RANGLE) {
    advance(cursor, 2);
    return createToken("dict_end", start, cursor.position);
  }

  // Hex string <...>
  if (byte === LANGLE) {
    return readHexString(cursor);
  }

  // Literal string (...)
  if (byte === LPAREN) {
    return readLiteralString(cursor);
  }

  // Array start
  if (byte === LBRACKET) {
    advance(cursor);
    return createToken("array_start", start, cursor.position);
  }

  // Array end
  if (byte === RBRACKET) {
    advance(cursor);
    return createToken("array_end", start, cursor.position);
  }

  // Name /...
  if (byte === SLASH) {
    return readName(cursor, maxNameBytes);
  }

  // Number
  if (isNumberStart(byte)) {
    return readNumber(cursor);
  }

  // Keyword (true, false, null, obj, endobj, stream, endstream, xref, trailer, startxref, R, n, f)
  return readKeyword(cursor);
}

/**
 * Read hex string token
 */
function readHexString(cursor: Cursor): Token {
  const start = cursor.position;
  advance(cursor); // Skip <
  let terminated = false;

  while (hasMore(cursor)) {
    const byte = peek(cursor);
    if (byte === RANGLE) {
      advance(cursor);
      terminated = true;
      break;
    }
    advance(cursor);
  }

  if (!terminated) {
    throw new Error(`Unterminated hex string at position ${start}`);
  }

  return createToken("hexstring", start, cursor.position);
}

/**
 * Read literal string token
 * Handles nested parentheses and escape sequences
 */
function readLiteralString(cursor: Cursor): Token {
  const start = cursor.position;
  advance(cursor); // Skip (

  let depth = 1;

  while (hasMore(cursor) && depth > 0) {
    const byte = read(cursor);

    if (byte === BACKSLASH) {
      // Skip escaped character
      if (hasMore(cursor)) {
        advance(cursor);
      }
    } else if (byte === LPAREN) {
      depth++;
    } else if (byte === RPAREN) {
      depth--;
    }
  }

  if (depth !== 0) {
    throw new Error(`Unterminated literal string at position ${start}`);
  }

  return createToken("string", start, cursor.position);
}

/**
 * Read name token
 */
function readName(cursor: Cursor, maxNameBytes: number): Token {
  const start = cursor.position;
  advance(cursor); // Skip /

  const nameStart = cursor.position;

  while (hasMore(cursor)) {
    const byte = peek(cursor);
    if (isWhitespace(byte) || isDelimiter(byte)) {
      break;
    }
    advance(cursor);
  }

  // Decode name (handle #XX hex codes)
  const nameBytes = cursor.buffer.subarray(nameStart, cursor.position);
  if (maxNameBytes !== Infinity && nameBytes.length > maxNameBytes) {
    throw new Error(
      `PDF name size ${nameBytes.length} exceeds maximum allowed (${maxNameBytes} bytes)`,
    );
  }
  const name = decodeName(nameBytes);

  return createToken("name", start, cursor.position, name);
}

/**
 * Decode PDF name handling #XX hex escapes
 */
function decodeName(bytes: Uint8Array): string {
  let hasEscape = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === HASH) {
      hasEscape = true;
      break;
    }
  }

  if (!hasEscape) {
    return bytesToString(bytes);
  }

  // Handle escape sequences
  const result = new Uint8Array(bytes.length);
  let resultLength = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === HASH && i + 2 < bytes.length) {
      const hi = bytes[i + 1];
      const lo = bytes[i + 2];
      if (hi !== undefined && lo !== undefined && isHexDigit(hi) && isHexDigit(lo)) {
        result[resultLength++] = (hexValue(hi) << 4) | hexValue(lo);
        i += 2;
        continue;
      }
    }
    const byte = bytes[i];
    if (byte !== undefined) {
      result[resultLength++] = byte;
    }
  }

  return bytesToString(result.subarray(0, resultLength));
}

/**
 * Read number token (integer or real)
 * A valid PDF number must contain at least one digit.
 * Standalone ".", "+", "-" are not valid numbers.
 */
function readNumber(cursor: Cursor): Token {
  const start = cursor.position;
  let hasDigit = false;
  let hasDecimal = false;
  let byte = peek(cursor);

  // Handle sign
  if (byte === PLUS || byte === MINUS) {
    advance(cursor);
  }

  // Read digits before decimal point
  while (hasMore(cursor)) {
    byte = peek(cursor);
    if (byte === DOT) {
      if (hasDecimal) {
        break; // Second dot - stop
      }
      hasDecimal = true;
      advance(cursor);
    } else if (isDigit(byte)) {
      hasDigit = true;
      advance(cursor);
    } else {
      break;
    }
  }

  // A valid number must have at least one digit
  if (!hasDigit) {
    throw new Error(`Invalid number token at position ${start}`);
  }

  // Parse the number value
  const numStr = bytesToString(cursor.buffer.subarray(start, cursor.position));
  const value = hasDecimal ? Number.parseFloat(numStr) : Number.parseInt(numStr, 10);

  return createToken("number", start, cursor.position, value);
}

/**
 * Check that the byte after a matched keyword is a valid boundary
 * (whitespace, delimiter, or EOF)
 */
function isKeywordBoundary(cursor: Cursor, endPos: number): boolean {
  if (endPos >= cursor.buffer.length) {
    return true; // EOF is a valid boundary
  }
  const nextByte = cursor.buffer[endPos];
  return nextByte === undefined || isWhitespace(nextByte) || isDelimiter(nextByte);
}

/**
 * Try to match a known keyword. Returns the keyword value string if matched
 * AND the next byte is a valid boundary, otherwise null.
 */
function tryMatchKeyword(cursor: Cursor, keywordBytes: Uint8Array, value: string): string | null {
  if (!matchPattern(cursor, keywordBytes)) {
    return null;
  }
  const endPos = cursor.position + keywordBytes.length;
  if (!isKeywordBoundary(cursor, endPos)) {
    return null;
  }
  advance(cursor, keywordBytes.length);
  return value;
}

/**
 * Read keyword token
 */
function readKeyword(cursor: Cursor): Token {
  const start = cursor.position;

  // Check for known keywords (ordered by length descending to avoid partial matches)
  const knownKeywords: [Uint8Array, string][] = [
    [KEYWORD_ENDSTREAM, "endstream"],
    [KEYWORD_STARTXREF, "startxref"],
    [KEYWORD_TRAILER, "trailer"],
    [KEYWORD_ENDOBJ, "endobj"],
    [KEYWORD_STREAM, "stream"],
    [KEYWORD_FALSE, "false"],
    [KEYWORD_TRUE, "true"],
    [KEYWORD_NULL, "null"],
    [KEYWORD_XREF, "xref"],
    [KEYWORD_OBJ, "obj"],
    [KEYWORD_R, "R"],
    [KEYWORD_N, "n"],
    [KEYWORD_F, "f"],
  ];

  for (const [keywordBytes, value] of knownKeywords) {
    const matched = tryMatchKeyword(cursor, keywordBytes, value);
    if (matched !== null) {
      return createToken("keyword", start, cursor.position, matched);
    }
  }

  // Unknown keyword - read until whitespace or delimiter
  // Always consume at least one byte to guarantee cursor progress
  while (hasMore(cursor)) {
    const byte = peek(cursor);
    if (isWhitespace(byte) || isDelimiter(byte)) {
      if (cursor.position === start) {
        // No bytes consumed yet — consume this byte to avoid zero-length token
        advance(cursor);
      }
      break;
    }
    advance(cursor);
  }

  // If still no progress (e.g., isolated delimiter), consume one byte
  if (cursor.position === start && hasMore(cursor)) {
    advance(cursor);
  }

  const keyword = bytesToString(cursor.buffer.subarray(start, cursor.position));
  return createToken("keyword", start, cursor.position, keyword);
}

/**
 * Peek at next token without consuming it
 */
export function peekToken(cursor: Cursor, maxNameBytes: number = Infinity): Token | null {
  const savedPosition = cursor.position;
  const token = nextToken(cursor, maxNameBytes);
  cursor.position = savedPosition;
  return token;
}

/**
 * Expect a specific token type
 */
export function expectToken(cursor: Cursor, expectedType: TokenType): Token {
  const token = nextToken(cursor);
  if (!token || token.type !== expectedType) {
    throw new Error(
      `Expected token type ${expectedType}, got ${token?.type ?? "null"} at position ${cursor.position}`,
    );
  }
  return token;
}

/**
 * Expect a specific keyword
 */
export function expectKeyword(cursor: Cursor, keyword: string): Token {
  const token = nextToken(cursor);
  if (token?.type !== "keyword" || token.value !== keyword) {
    throw new Error(
      `Expected keyword "${keyword}", got ${token?.value ?? "null"} at position ${cursor.position}`,
    );
  }
  return token;
}
