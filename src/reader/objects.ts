/**
 * PDF Object Parsers
 * Functions for parsing all PDF object types
 */

import { CR, hexValue, isWhitespace, LF, skipWhitespaceAndComments } from './buffer.js';
import { nextToken, peekToken } from './tokenizer.js';
import type {
  Cursor,
  ObjectParseBudget,
  ObjectParseOptions,
  PDFArray,
  PDFBoolean,
  PDFDictionary,
  PDFHexString,
  PDFNull,
  PDFNumber,
  PDFObject,
  PDFReference,
  PDFStream,
  PDFString,
  Token,
} from './types.js';
import {
  createArray,
  createBoolean,
  createDictionary,
  createHexString,
  createName,
  createNull,
  createNumber,
  createObjectParseBudget,
  createReference,
  createStream,
  createString,
  DEFAULT_PARSE_LIMITS,
  MAX_PDF_GENERATION,
} from './types.js';

// ============================================================================
// Object Parsing
// ============================================================================

type ObjectParseContext = {
  budget: ObjectParseBudget;
};

function createObjectParseContext(budget: ObjectParseBudget): ObjectParseContext {
  return { budget };
}

/** Error raised when a document-wide direct-value budget is exhausted. */
export class ObjectValueLimitError extends Error {
  readonly limit: number;

  constructor(limit: number, position: number) {
    super(`Maximum PDF object values (${limit}) exceeded at position ${position}`);
    this.name = 'ObjectValueLimitError';
    this.limit = limit;
  }
}

/**
 * Parse any PDF object from cursor position
 */
export function parseObject(
  cursor: Cursor,
  limits: ObjectParseOptions = DEFAULT_PARSE_LIMITS,
  depth: number = 0,
  budget: ObjectParseBudget = createObjectParseBudget(limits.maxObjectValues)
): PDFObject {
  return parseObjectInternal(cursor, limits, depth, createObjectParseContext(budget));
}

function parseObjectInternal(
  cursor: Cursor,
  limits: ObjectParseOptions,
  depth: number,
  context: ObjectParseContext
): PDFObject {
  if (depth > limits.maxDepth) {
    throw new Error(
      `Maximum PDF object nesting depth (${limits.maxDepth}) exceeded at position ${cursor.position}`
    );
  }

  const token = peekToken(cursor, limits.maxStringBytes);

  if (!token) {
    throw new Error(`Unexpected end of input at position ${cursor.position}`);
  }

  if (context.budget.limit !== Infinity && context.budget.used >= context.budget.limit) {
    throw new ObjectValueLimitError(context.budget.limit, cursor.position);
  }
  context.budget.used++;

  switch (token.type) {
    case 'keyword':
      return parseKeywordObject(cursor, token);

    case 'number':
      return parseNumberOrReference(cursor, limits.maxStringBytes);

    case 'name':
      nextToken(cursor, limits.maxStringBytes); // consume token
      return createName(token.value as string);

    case 'string':
      return parseLiteralString(cursor, token, limits);

    case 'hexstring':
      return parseHexString(cursor, token, limits);

    case 'array_start':
      return parseArray(cursor, limits, depth, context);

    case 'dict_start':
      return parseDictionaryOrStream(cursor, limits, depth, context);

    default:
      throw new Error(`Unexpected token type: ${token.type} at position ${token.start}`);
  }
}

/**
 * Parse keyword object (true, false, null)
 */
function parseKeywordObject(cursor: Cursor, token: Token): PDFNull | PDFBoolean {
  nextToken(cursor); // consume token

  switch (token.value) {
    case 'true':
      return createBoolean(true);
    case 'false':
      return createBoolean(false);
    case 'null':
      return createNull();
    default:
      throw new Error(`Unexpected keyword: ${token.value} at position ${token.start}`);
  }
}

/**
 * Parse number or indirect reference (e.g., "1 0 R")
 */
function parseNumberOrReference(cursor: Cursor, maxNameBytes: number): PDFNumber | PDFReference {
  const token1 = nextToken(cursor, maxNameBytes);
  if (token1?.type !== 'number') {
    throw new Error(`Expected number at position ${cursor.position}`);
  }

  // Check if this might be a reference
  const savedPos = cursor.position;
  const token2 = peekToken(cursor, maxNameBytes);

  if (token2 && token2.type === 'number') {
    nextToken(cursor, maxNameBytes); // consume token2
    const token3 = peekToken(cursor, maxNameBytes);

    if (
      token3 &&
      token3.type === 'keyword' &&
      token3.value === 'R' &&
      Number.isSafeInteger(token1.value) &&
      (token1.value as number) >= 0 &&
      Number.isSafeInteger(token2.value) &&
      (token2.value as number) >= 0 &&
      (token2.value as number) <= MAX_PDF_GENERATION
    ) {
      nextToken(cursor, maxNameBytes); // consume R
      return createReference(token1.value as number, token2.value as number);
    }

    if (token3?.type === 'keyword' && token3.value === 'R') {
      throw new Error(`Invalid PDF reference at position ${token1.start}`);
    }

    // Not a reference, restore position
    cursor.position = savedPos;
  }

  return createNumber(token1.value as number);
}

/**
 * Parse literal string from token
 */
function parseLiteralString(cursor: Cursor, token: Token, limits: ObjectParseOptions): PDFString {
  nextToken(cursor); // consume token

  // Extract string content (excluding parentheses)
  const raw = cursor.buffer.subarray(token.start + 1, token.end - 1);
  ensureStringSize(raw, limits);

  // Decode escape sequences
  return createString(decodeStringEscapes(raw));
}

/**
 * Decode escape sequences in PDF literal string
 */
function decodeStringEscapes(bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(bytes.length);
  let resultLength = 0;
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i];

    if (byte === 0x5c) {
      // backslash
      i++;
      if (i >= bytes.length) break;

      const next = bytes[i];
      switch (next) {
        case 0x6e: // n
          result[resultLength++] = LF;
          break;
        case 0x72: // r
          result[resultLength++] = CR;
          break;
        case 0x74: // t
          result[resultLength++] = 0x09; // tab
          break;
        case 0x62: // b
          result[resultLength++] = 0x08; // backspace
          break;
        case 0x66: // f
          result[resultLength++] = 0x0c; // form feed
          break;
        case 0x28: // (
        case 0x29: // )
        case 0x5c: // \
          result[resultLength++] = next;
          break;
        case CR:
          // Line continuation - skip CR and optional LF
          if (bytes[i + 1] === LF) {
            i++;
          }
          break;
        case LF:
          // Line continuation - skip LF
          break;
        default:
          // Octal escape
          if (next !== undefined && next >= 0x30 && next <= 0x37) {
            let octal = next - 0x30;
            if (i + 1 < bytes.length) {
              const next2 = bytes[i + 1];
              if (next2 !== undefined && next2 >= 0x30 && next2 <= 0x37) {
                octal = octal * 8 + (next2 - 0x30);
                i++;
                if (i + 1 < bytes.length) {
                  const next3 = bytes[i + 1];
                  if (next3 !== undefined && next3 >= 0x30 && next3 <= 0x37) {
                    octal = octal * 8 + (next3 - 0x30);
                    i++;
                  }
                }
              }
            }
            result[resultLength++] = octal & 0xff;
          } else if (next !== undefined) {
            result[resultLength++] = next;
          }
      }
    } else if (byte !== undefined) {
      result[resultLength++] = byte;
    }
    i++;
  }

  return result.subarray(0, resultLength);
}

/**
 * Parse hex string from token
 */
function parseHexString(cursor: Cursor, token: Token, limits: ObjectParseOptions): PDFHexString {
  nextToken(cursor); // consume token

  // Extract hex content (excluding angle brackets)
  const hexBytes = cursor.buffer.subarray(token.start + 1, token.end - 1);
  ensureStringSize(hexBytes, limits);

  // Decode hex
  return createHexString(decodeHexString(hexBytes, token.start + 1));
}

/**
 * Decode hex string to bytes
 */
function decodeHexString(bytes: Uint8Array, sourceOffset: number): Uint8Array {
  const result = new Uint8Array(Math.ceil(bytes.length / 2));
  let resultLength = 0;
  let highNibble: number | null = null;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;

    if (isWhitespace(byte)) continue;

    const nibble = hexValue(byte);
    if (nibble === -1) {
      throw new Error(
        `Invalid hex string byte 0x${byte.toString(16).padStart(2, '0')} at position ${sourceOffset + i}`
      );
    }

    if (highNibble === null) {
      highNibble = nibble;
    } else {
      result[resultLength++] = (highNibble << 4) | nibble;
      highNibble = null;
    }
  }

  // If odd number of hex digits, append 0
  if (highNibble !== null) {
    result[resultLength++] = highNibble << 4;
  }

  return result.subarray(0, resultLength);
}

function ensureStringSize(bytes: Uint8Array, limits: ObjectParseOptions): void {
  if (limits.maxStringBytes !== Infinity && bytes.length > limits.maxStringBytes) {
    throw new Error(
      `PDF string size ${bytes.length} exceeds maximum allowed (${limits.maxStringBytes} bytes)`
    );
  }
}

/**
 * Parse array
 */
function parseArray(
  cursor: Cursor,
  limits: ObjectParseOptions,
  depth: number,
  context: ObjectParseContext
): PDFArray {
  nextToken(cursor); // consume [

  const items: PDFObject[] = [];

  while (true) {
    const token = peekToken(cursor, limits.maxStringBytes);

    if (!token) {
      throw new Error(`Unexpected end of array at position ${cursor.position}`);
    }

    if (token.type === 'array_end') {
      nextToken(cursor); // consume ]
      break;
    }

    items.push(parseObjectInternal(cursor, limits, depth + 1, context));
  }

  return createArray(items);
}

/**
 * Parse dictionary or stream
 */
function parseDictionaryOrStream(
  cursor: Cursor,
  limits: ObjectParseOptions,
  depth: number,
  context: ObjectParseContext
): PDFDictionary | PDFStream {
  const dict = parseDictionary(cursor, limits, depth, context);

  // Check if followed by stream
  skipWhitespaceAndComments(cursor);
  const token = peekToken(cursor, limits.maxStringBytes);

  if (token && token.type === 'keyword' && token.value === 'stream') {
    return parseStream(cursor, dict, limits);
  }

  return dict;
}

/**
 * Parse dictionary
 */
function parseDictionary(
  cursor: Cursor,
  limits: ObjectParseOptions,
  depth: number,
  context: ObjectParseContext
): PDFDictionary {
  nextToken(cursor); // consume <<

  const entries = new Map<string, PDFObject>();

  while (true) {
    const token = peekToken(cursor, limits.maxStringBytes);

    if (!token) {
      throw new Error(`Unexpected end of dictionary at position ${cursor.position}`);
    }

    if (token.type === 'dict_end') {
      nextToken(cursor); // consume >>
      break;
    }

    if (token.type !== 'name') {
      throw new Error(`Expected name in dictionary, got ${token.type} at position ${token.start}`);
    }

    nextToken(cursor, limits.maxStringBytes); // consume name
    const key = token.value as string;
    const value = parseObjectInternal(cursor, limits, depth + 1, context);

    entries.set(key, value);
  }

  return createDictionary(entries);
}

/**
 * Parse stream
 */
function parseStream(cursor: Cursor, dict: PDFDictionary, limits: ObjectParseOptions): PDFStream {
  nextToken(cursor); // consume 'stream' keyword

  // Stream keyword must be followed by EOL
  // Skip single EOL (CR, LF, or CRLF)
  const byte = cursor.buffer[cursor.position];
  if (byte === CR) {
    cursor.position++;
    if (cursor.buffer[cursor.position] === LF) {
      cursor.position++;
    }
  } else if (byte === LF) {
    cursor.position++;
  }

  // Get stream length from dictionary
  const lengthObj = dict.entries.get('Length');
  let length: number;

  if (!lengthObj) {
    throw new Error(`Stream missing Length at position ${cursor.position}`);
  }

  if (lengthObj.type === 'number') {
    length = lengthObj.value;

    // Validate: Length must be a non-negative integer
    if (!Number.isInteger(length) || length < 0) {
      throw new Error(
        `Invalid stream Length: ${length} at position ${cursor.position}. ` +
          `Expected a non-negative integer.`
      );
    }

    if (length > limits.maxStreamBytes) {
      throw new Error(
        `Stream Length ${length} exceeds maximum allowed (${limits.maxStreamBytes} bytes) at position ${cursor.position}`
      );
    }

    // Bounds check: ensure stream data fits within buffer
    if (cursor.position + length > cursor.buffer.length) {
      throw new Error(
        `Stream Length ${length} exceeds buffer bounds at position ${cursor.position}. ` +
          `Buffer has ${cursor.buffer.length - cursor.position} bytes remaining.`
      );
    }
  } else if (lengthObj.type === 'reference') {
    // Length is an indirect reference — search for endstream marker
    // This is a best-effort heuristic; indirect Length should be resolved
    // by the caller before parsing the stream
    length = findEndStream(cursor);

    // Validate found length
    if (length < 0) {
      throw new Error(
        `Could not determine stream length from indirect reference at position ${cursor.position}`
      );
    }

    // Bounds check for found length
    if (cursor.position + length > cursor.buffer.length) {
      throw new Error(
        `Stream length ${length} (found via endstream search) exceeds buffer bounds at position ${cursor.position}`
      );
    }
    if (length > limits.maxStreamBytes) {
      throw new Error(
        `Stream length ${length} exceeds maximum allowed (${limits.maxStreamBytes} bytes) at position ${cursor.position}`
      );
    }
  } else {
    throw new Error(`Invalid stream Length type: ${lengthObj.type}`);
  }

  // Extract stream data as subarray (zero-copy)
  const data = cursor.buffer.subarray(cursor.position, cursor.position + length);
  cursor.position += length;

  // Skip to endstream
  skipWhitespaceAndComments(cursor);
  const endToken = nextToken(cursor);
  if (endToken?.value !== 'endstream') {
    throw new Error(`Missing endstream marker after stream at position ${cursor.position}`);
  }

  return createStream(dict, data);
}

/**
 * Find endstream keyword to determine stream length (for indirect Length)
 * Searches from current cursor position.
 * Returns -1 if not found.
 */
function findEndStream(cursor: Cursor): number {
  const ENDSTREAM = new Uint8Array([0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]); // "endstream"
  const start = cursor.position;

  for (let i = start; i <= cursor.buffer.length - ENDSTREAM.length; i++) {
    let match = true;
    for (let j = 0; j < ENDSTREAM.length; j++) {
      if (cursor.buffer[i + j] !== ENDSTREAM[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Verify this endstream is preceded by EOL (it should be at start of line)
      // Per PDF spec, endstream must be at the beginning of a line
      if (i > start) {
        const prevByte = cursor.buffer[i - 1];
        if (prevByte !== LF && prevByte !== CR) {
          // endstream not at line start — could be inside stream data, skip
          continue;
        }
      }
      // Calculate length: bytes from start to endstream, excluding preceding EOL
      let end = i;
      if (end > start && cursor.buffer[end - 1] === LF) {
        end--;
        if (end > start && cursor.buffer[end - 1] === CR) {
          end--;
        }
      } else if (end > start && cursor.buffer[end - 1] === CR) {
        end--;
      }
      return end - start;
    }
  }

  return -1;
}

// ============================================================================
// Indirect Object Parsing
// ============================================================================

/**
 * Parse indirect object definition (e.g., "1 0 obj ... endobj")
 */
export function parseIndirectObject(
  cursor: Cursor,
  limits: ObjectParseOptions = DEFAULT_PARSE_LIMITS,
  budget: ObjectParseBudget = createObjectParseBudget(limits.maxObjectValues)
): {
  objectNumber: number;
  generation: number;
  value: PDFObject;
} {
  skipWhitespaceAndComments(cursor);

  // Read object number
  const objNumToken = nextToken(cursor);
  if (
    objNumToken?.type !== 'number' ||
    !Number.isSafeInteger(objNumToken.value) ||
    (objNumToken.value as number) < 0
  ) {
    throw new Error(`Expected object number at position ${cursor.position}`);
  }

  // Read generation number
  const genNumToken = nextToken(cursor);
  if (
    genNumToken?.type !== 'number' ||
    !Number.isSafeInteger(genNumToken.value) ||
    (genNumToken.value as number) < 0 ||
    (genNumToken.value as number) > MAX_PDF_GENERATION
  ) {
    throw new Error(`Expected generation number at position ${cursor.position}`);
  }

  // Read 'obj' keyword
  const objToken = nextToken(cursor);
  if (objToken?.type !== 'keyword' || objToken.value !== 'obj') {
    throw new Error(`Expected 'obj' keyword at position ${cursor.position}`);
  }

  // Parse object value
  const value = parseObjectInternal(cursor, limits, 0, createObjectParseContext(budget));

  // Read 'endobj' keyword
  skipWhitespaceAndComments(cursor);
  const endObjToken = nextToken(cursor);
  if (endObjToken?.type !== 'keyword' || endObjToken.value !== 'endobj') {
    throw new Error(`Expected 'endobj' keyword at position ${cursor.position}`);
  }

  return {
    objectNumber: objNumToken.value as number,
    generation: genNumToken.value as number,
    value,
  };
}
