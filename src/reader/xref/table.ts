/**
 * XRef Table Parser
 * Parses classic XRef tables (text format)
 */

import {
  bytesToString,
  createCursor,
  isDigit,
  KEYWORD_XREF,
  matchPattern,
  parseInteger,
  skipWhitespace,
} from "../buffer.js";
import { parseObject } from "../objects.js";
import { nextToken } from "../tokenizer.js";
import type {
  Cursor,
  ObjectParseBudget,
  ParseLimits,
  PDFDictionary,
  XRefEntry,
  XRefSection,
} from "../types.js";
import { DEFAULT_PARSE_LIMITS, MAX_PDF_GENERATION } from "../types.js";

// ============================================================================
// XRef Table Parsing
// ============================================================================

/**
 * Check if position contains XRef table (not stream)
 */
export function isXRefTable(buffer: Uint8Array, position: number): boolean {
  const cursor = createCursor(buffer, position);
  return matchPattern(cursor, KEYWORD_XREF);
}

/**
 * Parse XRef table at given position
 */
export function parseXRefTable(
  buffer: Uint8Array,
  position: number,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS,
  objectValueBudget?: ObjectParseBudget,
): XRefSection {
  const cursor = createCursor(buffer, position);

  // Expect 'xref' keyword
  const token = nextToken(cursor);
  if (token?.value !== "xref") {
    throw new Error(`Expected 'xref' at position ${position}`);
  }

  const entries = new Map<number, XRefEntry>();
  let totalObjectEntries = 0;
  let objectZeroSeen = false;

  // Parse subsections
  while (true) {
    skipWhitespace(cursor);

    // Check for trailer
    const nextTokenPeek = cursor.buffer.subarray(cursor.position, cursor.position + 7);
    if (bytesToString(nextTokenPeek) === "trailer") {
      break;
    }

    // Parse subsection header: first_object_number count
    const subsectionStart = readNumber(cursor, "subsection start");
    skipWhitespace(cursor);
    const subsectionCount = readNumber(cursor, "subsection count");

    if (
      !Number.isSafeInteger(subsectionStart) ||
      !Number.isSafeInteger(subsectionCount) ||
      subsectionStart < 0 ||
      subsectionCount < 0
    ) {
      throw new Error(`Invalid XRef subsection ${subsectionStart} ${subsectionCount}`);
    }
    const includesObjectZero = subsectionStart === 0 && subsectionCount > 0;
    const objectEntries = subsectionCount - (includesObjectZero && !objectZeroSeen ? 1 : 0);
    if (
      (limits.maxObjects !== Infinity &&
        (totalObjectEntries > limits.maxObjects ||
          objectEntries > limits.maxObjects - totalObjectEntries)) ||
      subsectionStart + subsectionCount > Number.MAX_SAFE_INTEGER
    ) {
      throw new Error(
        `XRef object entries exceed maximum allowed (${limits.maxObjects}) at subsection ${subsectionStart}`,
      );
    }
    totalObjectEntries += objectEntries;
    if (includesObjectZero) objectZeroSeen = true;

    // Parse entries
    for (let i = 0; i < subsectionCount; i++) {
      skipWhitespace(cursor);

      const entry = parseXRefEntry(cursor, subsectionStart + i);
      entries.set(subsectionStart + i, entry);
    }
  }

  // Parse trailer
  const trailerToken = nextToken(cursor);
  if (trailerToken?.value !== "trailer") {
    throw new Error(`Expected 'trailer' at position ${cursor.position}`);
  }

  const trailerObj = parseObject(cursor, limits, 0, objectValueBudget);
  if (trailerObj.type !== "dictionary") {
    throw new Error(`Expected dictionary after trailer at position ${cursor.position}`);
  }

  const trailer = trailerObj as PDFDictionary;

  // Get Prev if exists
  const prevObj = trailer.entries.get("Prev");

  const section: XRefSection = {
    entries,
    trailer,
    startXRef: position,
  };

  if (prevObj !== undefined) {
    if (prevObj.type === "number" && Number.isSafeInteger(prevObj.value) && prevObj.value >= 0) {
      section.prev = prevObj.value;
    } else {
      section.malformedPrev = true;
    }
  }

  return section;
}

/**
 * Parse single XRef entry (20 bytes: 10-digit offset + 5-digit generation + 1 char type + EOL)
 */
function parseXRefEntry(cursor: Cursor, objectNumber: number): XRefEntry {
  // Format: nnnnnnnnnn ggggg n/f (20 bytes total including EOL)
  // Read 10-digit offset
  const offset = readFixedDigits(cursor, 10, `offset for object ${objectNumber}`);
  cursor.position += 10;

  requireByte(cursor, 0x20, `space after offset for object ${objectNumber}`);
  cursor.position++;

  // Read 5-digit generation
  const generation = readFixedDigits(cursor, 5, `generation for object ${objectNumber}`);
  cursor.position += 5;

  if (generation > MAX_PDF_GENERATION) {
    throw new Error(
      `XRef generation ${generation} exceeds maximum allowed (${MAX_PDF_GENERATION}) for object ${objectNumber}`,
    );
  }

  requireByte(cursor, 0x20, `space before entry type for object ${objectNumber}`);
  cursor.position++;

  // Read entry type (n or f)
  const entryType = cursor.buffer[cursor.position];
  if (entryType !== 0x6e && entryType !== 0x66) {
    throw new Error(`Invalid XRef entry type for object ${objectNumber}`);
  }
  cursor.position++;

  // Skip EOL (can be 1 or 2 bytes)
  if (cursor.buffer[cursor.position] === 0x0d) {
    // CR
    cursor.position++;
    if (cursor.buffer[cursor.position] === 0x0a) {
      // LF
      cursor.position++;
    }
  } else if (cursor.buffer[cursor.position] === 0x0a) {
    // LF
    cursor.position++;
  } else if (cursor.buffer[cursor.position] === 0x20) {
    // Space (some PDFs use space)
    cursor.position++;
  }

  if (entryType === 0x6e) {
    // 'n' - in use
    return {
      type: "used",
      offset,
      generation,
    };
  } else if (entryType === 0x66) {
    // 'f' - free
    return {
      type: "free",
      nextFreeObject: offset,
      generation,
    };
  }

  throw new Error(`Invalid XRef entry for object ${objectNumber}`);
}

/**
 * Read number from cursor (simple integer parsing for xref)
 */
function readNumber(cursor: Cursor, label: string): number {
  const start = cursor.position;

  while (cursor.position < cursor.buffer.length) {
    const byte = cursor.buffer[cursor.position];
    if (byte !== undefined && isDigit(byte)) {
      cursor.position++;
    } else {
      break;
    }
  }

  if (cursor.position === start) {
    throw new Error(`Expected ${label} at position ${start}`);
  }
  return parseInteger(cursor.buffer, start, cursor.position);
}

function readFixedDigits(cursor: Cursor, width: number, label: string): number {
  if (cursor.position + width > cursor.buffer.length) {
    throw new Error(`Truncated XRef ${label} at position ${cursor.position}`);
  }
  const start = cursor.position;
  for (let i = 0; i < width; i++) {
    const byte = cursor.buffer[cursor.position + i];
    if (byte === undefined || !isDigit(byte)) {
      throw new Error(`Invalid XRef ${label} at position ${cursor.position}`);
    }
  }
  return parseInteger(cursor.buffer, start, start + width);
}

function requireByte(cursor: Cursor, expected: number, label: string): void {
  if (cursor.position >= cursor.buffer.length || cursor.buffer[cursor.position] !== expected) {
    throw new Error(`Expected ${label} at position ${cursor.position}`);
  }
}
