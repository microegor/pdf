/**
 * XRef Stream Parser
 * Parses compressed XRef streams (PDF 1.5+)
 */

import { createCursor } from "../buffer.js";
import { parseIndirectObject } from "../objects.js";
import { decodeStream } from "../stream.js";
import type {
  ObjectParseBudget,
  ParseLimits,
  PDFArray,
  PDFStream,
  XRefEntry,
  XRefSection,
} from "../types.js";
import { DEFAULT_PARSE_LIMITS, MAX_PDF_GENERATION } from "../types.js";

// ============================================================================
// XRef Stream Parsing
// ============================================================================

/**
 * Check if position contains XRef stream (not table)
 */
export function isXRefStream(buffer: Uint8Array, position: number): boolean {
  // XRef stream starts with object definition (e.g., "1 0 obj")
  // Check for digit at start
  const byte = buffer[position];
  return byte !== undefined && byte >= 0x30 && byte <= 0x39;
}

/**
 * Parse XRef stream at given position
 */
export function parseXRefStream(
  buffer: Uint8Array,
  position: number,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS,
  objectValueBudget?: ObjectParseBudget,
): XRefSection {
  const cursor = createCursor(buffer, position);

  // Parse the indirect object containing the XRef stream
  const indirectObj = parseIndirectObject(cursor, limits, objectValueBudget);

  if (indirectObj.value.type !== "stream") {
    throw new Error(`Expected stream object at position ${position}`);
  }

  const stream = indirectObj.value as PDFStream;
  const dict = stream.dictionary;

  // Verify it's an XRef stream
  const typeObj = dict.entries.get("Type");
  if (typeObj?.type !== "name" || typeObj.value !== "XRef") {
    throw new Error(`Expected XRef stream type at position ${position}`);
  }

  // Get stream parameters
  const sizeObj = dict.entries.get("Size");
  if (sizeObj?.type !== "number") {
    throw new Error(`Missing Size in XRef stream at position ${position}`);
  }
  const size = sizeObj.value;

  // /Size is an object-number upper bound, not an allocation count. The
  // actual number of entries is limited from /Index ranges below.
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error(`Invalid Size ${size} in XRef stream at position ${position}`);
  }

  // Get W array (field widths)
  const wObj = dict.entries.get("W");
  if (wObj?.type !== "array") {
    throw new Error(`Missing W array in XRef stream at position ${position}`);
  }
  const wArray = wObj as PDFArray;
  if (wArray.items.length !== 3) {
    throw new Error(`Invalid W array length in XRef stream at position ${position}`);
  }

  const wValues = wArray.items.map((item, index) => {
    if (item.type !== "number" || !Number.isSafeInteger(item.value) || item.value < 0) {
      throw new Error(`Invalid W[${index}] in XRef stream at position ${position}`);
    }
    return item.value;
  });
  const w: [number, number, number] = [wValues[0] ?? 0, wValues[1] ?? 0, wValues[2] ?? 0];

  // Validate total entry width
  const entryWidth = w[0] + w[1] + w[2];
  if (entryWidth === 0) {
    throw new Error(`XRef stream W array sums to zero at position ${position}`);
  }
  if (entryWidth > 256) {
    throw new Error(
      `XRef stream entry width ${entryWidth} exceeds maximum allowed (256) at position ${position}`,
    );
  }

  // Get Index array (subsection ranges)
  const indexObj = dict.entries.get("Index");
  let index: number[];
  if (indexObj === undefined) {
    // Default: single subsection starting at 0
    index = [0, size];
  } else if (indexObj.type === "array") {
    const indexArray = indexObj as PDFArray;
    if (indexArray.items.length % 2 !== 0) {
      throw new Error(`Invalid odd-length Index array in XRef stream at position ${position}`);
    }
    index = indexArray.items.map((item, i) => {
      if (item.type !== "number" || !Number.isSafeInteger(item.value) || item.value < 0) {
        throw new Error(`Invalid Index[${i}] in XRef stream at position ${position}`);
      }
      return item.value;
    });
  } else {
    throw new Error(`Invalid Index in XRef stream at position ${position}: expected an array`);
  }

  for (let i = 0; i < index.length; i += 2) {
    const first = index[i] ?? 0;
    const count = index[i + 1] ?? 0;
    if (first + count > size) {
      throw new Error(`XRef stream Index range [${first}, ${count}] exceeds Size ${size}`);
    }
  }

  // Decompress stream data
  const decodedData = decodeStream(stream, limits);

  // Parse entries from decoded data
  const entries = parseXRefStreamEntries(decodedData, w, index, limits.maxObjects);

  // Get Prev if exists
  const prevObj = dict.entries.get("Prev");

  const section: XRefSection = {
    entries,
    trailer: dict, // XRef stream dictionary serves as trailer
    startXRef: position,
    xrefStreamObject: {
      offset: position,
      objectNumber: indirectObj.objectNumber,
      generation: indirectObj.generation,
      value: stream,
    },
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
 * Parse XRef entries from decoded stream data
 */
function parseXRefStreamEntries(
  data: Uint8Array,
  w: [number, number, number],
  index: number[],
  maxObjects: number,
): Map<number, XRefEntry> {
  const entries = new Map<number, XRefEntry>();
  const entryWidth = w[0] + w[1] + w[2];
  let dataOffset = 0;

  // Calculate total expected entries for validation
  let totalExpectedEntries = 0;
  let totalExpectedObjects = 0;
  let objectZeroSeen = false;
  for (let i = 1; i < index.length; i += 2) {
    const first = index[i - 1] ?? 0;
    const count = index[i] ?? 0;
    const includesObjectZero = first === 0 && count > 0;
    totalExpectedEntries += count;
    totalExpectedObjects += count - (includesObjectZero && !objectZeroSeen ? 1 : 0);
    if (includesObjectZero) objectZeroSeen = true;
  }
  if (
    !Number.isSafeInteger(totalExpectedEntries) ||
    !Number.isSafeInteger(totalExpectedObjects) ||
    (maxObjects !== Infinity && totalExpectedObjects > maxObjects)
  ) {
    throw new Error(`XRef stream object entries exceed maximum allowed (${maxObjects})`);
  }
  if (totalExpectedEntries > Math.floor(Number.MAX_SAFE_INTEGER / entryWidth)) {
    throw new Error("XRef stream entry byte count exceeds safe integer range");
  }
  const totalExpectedBytes = totalExpectedEntries * entryWidth;
  if (totalExpectedBytes > data.length) {
    throw new Error(
      `XRef stream data too short: expected ${totalExpectedBytes} bytes for ` +
        `${totalExpectedEntries} entries (width=${entryWidth}), got ${data.length} bytes`,
    );
  }

  // Process each subsection
  for (let i = 0; i < index.length; i += 2) {
    const firstObj = index[i] ?? 0;
    const count = index[i + 1] ?? 0;

    if (!Number.isInteger(firstObj) || firstObj < 0 || !Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid XRef subsection [${firstObj}, ${count}]`);
    }
    if (firstObj + count > Number.MAX_SAFE_INTEGER) {
      throw new Error("XRef subsection range exceeds safe integer range");
    }

    for (let j = 0; j < count; j++) {
      // Bounds check: ensure we don't read past data
      if (dataOffset + entryWidth > data.length) {
        throw new Error(
          `XRef stream data truncated: expected more entries but only ${data.length} bytes available. ` +
            `Processed ${entries.size} entries so far.`,
        );
      }

      const objectNumber = firstObj + j;

      // Read field values
      const field1 = readField(data, dataOffset, w[0]);
      dataOffset += w[0];

      const field2 = readField(data, dataOffset, w[1]);
      dataOffset += w[1];

      const field3 = readField(data, dataOffset, w[2]);
      dataOffset += w[2];

      // Type defaults to 1 if w[0] is 0
      const type = w[0] === 0 ? 1 : field1;

      if ((type === 0 || type === 1) && field3 > MAX_PDF_GENERATION) {
        throw new Error(
          `XRef generation ${field3} exceeds maximum allowed (${MAX_PDF_GENERATION}) for object ${objectNumber}`,
        );
      }

      switch (type) {
        case 0: // Free object
          entries.set(objectNumber, {
            type: "free",
            nextFreeObject: field2,
            generation: field3,
          });
          break;

        case 1: // Used object
          entries.set(objectNumber, {
            type: "used",
            offset: field2,
            generation: field3,
          });
          break;

        case 2: // Compressed object
          entries.set(objectNumber, {
            type: "compressed",
            objectStreamNumber: field2,
            indexInStream: field3,
          });
          break;

        default:
          throw new Error(`Unknown XRef entry type ${type} for object ${objectNumber}`);
      }
    }
  }

  return entries;
}

/**
 * Read multi-byte integer field from data.
 * Uses arithmetic accumulation to avoid 32-bit signed integer overflow
 * from JavaScript bitwise operators. Values larger than 2^53 - 1 are
 * rejected because they cannot be represented exactly by a JavaScript number.
 */
function readField(data: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let i = 0; i < width; i++) {
    // Use multiplication instead of bitwise shift to keep full precision
    value = value * 256 + (data[offset + i] ?? 0);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`XRef field at byte offset ${offset} exceeds safe integer range`);
    }
  }
  return value;
}
