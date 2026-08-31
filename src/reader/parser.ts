/**
 * PDF Parser
 * Main parsing logic for PDF documents
 */

import {
  bytesToString,
  EOF_MARKER,
  findPatternBackward,
  KEYWORD_STARTXREF,
  matchBytes,
  PDF_HEADER,
  parseInteger,
} from "./buffer.js";
import { buildCurrentState, buildHistoryIndex } from "./history.js";
import { ObjectValueLimitError } from "./objects.js";
import type {
  ObjectParseBudget,
  ParseDiagnostic,
  ParseLimits,
  ParseOptions,
  PDFDictionary,
  PDFDocument,
  PDFObject,
  XRefSection,
} from "./types.js";
import { createObjectParseBudget, DEFAULT_PARSE_LIMITS, objectKey } from "./types.js";
import { isXRefStream, isXRefTable, parseXRefStream, parseXRefTable } from "./xref/index.js";

// ============================================================================
// Document Parsing
// ============================================================================

/**
 * Parse PDF document from buffer
 */
export function parse(buffer: Uint8Array, options?: ParseOptions): PDFDocument {
  // Merge options with defaults
  const limits: ParseLimits = { ...DEFAULT_PARSE_LIMITS, ...options?.limits };
  validateLimits(limits);

  // Lazy history materialization must not observe mutations to the caller's
  // buffer after parse() returns.
  const sourceBuffer = buffer.slice();
  const diagnostics: ParseDiagnostic[] = [];
  const report = (diagnostic: ParseDiagnostic): void => {
    diagnostics.push(diagnostic);
    options?.onDiagnostic?.(diagnostic);
  };

  // File size limit check
  if (sourceBuffer.length > limits.maxFileBytes) {
    throw new Error(
      `PDF file size ${sourceBuffer.length} bytes exceeds maximum allowed ${limits.maxFileBytes} bytes. ` +
        `Adjust ParseLimits.maxFileBytes to process larger files.`,
    );
  }

  // Parse header to get version
  const version = parseHeader(sourceBuffer);

  // Find startxref position
  const startXRef = findStartXRef(sourceBuffer);

  // The same budget must cover XRef trailers, current objects, object streams
  // and lazy history materialization.
  const objectValueBudget = createObjectParseBudget(limits.maxObjectValues);

  // Parse all XRef sections (with hybrid normalization)
  const parsedSections = parseAllXRefSections(
    sourceBuffer,
    startXRef,
    limits,
    report,
    objectValueBudget,
  );
  const sections = parsedSections.sections;

  // Assign chronological revisionIndex to each section
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    if (section) section.revisionIndex = sections.length - 1 - si;
  }

  // Create document structure
  const doc: PDFDocument = {
    buffer: sourceBuffer,
    version,
    sections,
    objects: new Map(),
    history: {
      eventsByObject: new Map(),
      versionCache: new Map(),
      complete: true,
      limits,
      objectValueBudget,
      materializingKeys: new Set(),
      parsedStreamCache: new Map(),
    },
    complete: !parsedSections.truncated,
    diagnostics,
  };

  // Build history index (oldest→newest scan). A truncated XRef chain also
  // makes the historical view incomplete, even when the available sections
  // can be indexed without hitting an object-history limit.
  doc.history = buildHistoryIndex(doc, limits);
  if (parsedSections.truncated) {
    doc.history.complete = false;
    doc.history.incompleteReason ??=
      "The XRef revision chain was truncated during parsing; older history may be unavailable.";
  }
  if (!doc.history.complete) {
    report({
      code: "incomplete-history",
      message: doc.history.incompleteReason ?? "Object history index is incomplete.",
    });
  }

  // Build current state (newest→oldest scan, materialize active objects)
  const currentStateComplete = buildCurrentState(doc, limits, report);
  doc.complete = doc.complete && doc.history.complete && currentStateComplete;
  if (!doc.complete && !diagnostics.some((d) => d.code === "max-sections")) {
    const message = !currentStateComplete
      ? "The document was parsed partially because one or more objects could not be materialized."
      : parsedSections.truncated
        ? "The document was parsed partially because the XRef revision chain was truncated during recovery."
        : "The document was parsed partially because object history indexing was truncated.";
    report({
      code: "partial-document",
      message,
    });
  }

  return doc;
}

/**
 * Parse PDF header to get version
 */
function parseHeader(buffer: Uint8Array): string {
  if (!matchBytes(buffer, 0, PDF_HEADER)) {
    throw new Error("Invalid PDF header");
  }

  // Find end of version line
  let end = 5;
  while (end < buffer.length && end < 20) {
    const byte = buffer[end];
    if (byte === 0x0a || byte === 0x0d) {
      break;
    }
    end++;
  }

  // Extract version string (e.g., "1.7")
  const versionBytes = buffer.subarray(5, end);
  return bytesToString(versionBytes);
}

/**
 * Find startxref position
 */
function findStartXRef(buffer: Uint8Array): number {
  // Find %%EOF marker
  const eofPos = findPatternBackward(buffer, EOF_MARKER);
  if (eofPos === -1) {
    throw new Error("Could not find %%EOF marker");
  }

  // Find startxref before %%EOF (search within last 100 bytes)
  const startxrefPos = findPatternBackward(buffer, KEYWORD_STARTXREF, eofPos);
  if (startxrefPos === -1) {
    throw new Error("Could not find startxref");
  }

  // Read the offset after startxref
  let pos = startxrefPos + KEYWORD_STARTXREF.length;

  // Skip whitespace
  while (pos < buffer.length) {
    const byte = buffer[pos];
    if (byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      break;
    }
    pos++;
  }

  // Read number
  const numStart = pos;
  while (pos < buffer.length) {
    const byte = buffer[pos];
    if (byte === undefined || byte < 0x30 || byte > 0x39) {
      break;
    }
    pos++;
  }

  if (pos === numStart) {
    throw new Error(`Invalid startxref offset at position ${startxrefPos}`);
  }
  const offset = parseInteger(buffer, numStart, pos);
  if (offset < 0 || offset >= buffer.length) {
    throw new Error(`startxref offset ${offset} is outside the input buffer`);
  }
  return offset;
}

/**
 * Parse all XRef sections following Prev chain.
 * Tracks visited offsets to prevent infinite loops from cyclic /Prev.
 * Merges hybrid-reference tables: a classic XRef table with /XRefStm
 * is merged into ONE logical section (Phase 0 normalization).
 */
function parseAllXRefSections(
  buffer: Uint8Array,
  startXRef: number,
  limits: ParseLimits,
  report: (diagnostic: ParseDiagnostic) => void,
  objectValueBudget: ObjectParseBudget,
): { sections: XRefSection[]; truncated: boolean } {
  const sections: XRefSection[] = [];
  const visitedOffsets = new Set<number>();
  let currentPos: number | undefined = startXRef;
  let logicalCount = 0;
  let totalXRefEntries = 0;
  let truncated = false;

  while (currentPos !== undefined && logicalCount < limits.maxSections) {
    // Guard against cyclic /Prev chains
    if (visitedOffsets.has(currentPos)) {
      report({
        code: "cyclic-prev",
        message: `Cyclic /Prev chain detected at offset ${currentPos}. Stopping.`,
        position: currentPos,
      });
      truncated = true;
      break;
    }
    visitedOffsets.add(currentPos);

    let section: XRefSection;
    try {
      section = parseXRefSection(buffer, currentPos, limits, objectValueBudget);
    } catch (error) {
      if (error instanceof ObjectValueLimitError) {
        report({
          code: "max-object-values",
          message: error.message,
          position: currentPos,
        });
        truncated = true;
        break;
      }
      if (sections.length === 0) throw error;

      report({
        code: "invalid-prev",
        message:
          `Failed to parse previous XRef section at offset ${currentPos}: ` +
          `${error instanceof Error ? error.message : String(error)}. Stopping the revision chain.`,
        position: currentPos,
      });
      truncated = true;
      break;
    }
    const isTable = isXRefTable(buffer, currentPos);
    if (section.malformedPrev) {
      report({
        code: "malformed-prev",
        message: `Malformed /Prev value in XRef section at offset ${currentPos}. Stopping the revision chain.`,
        position: currentPos,
      });
      truncated = true;
    }
    const prev: number | undefined = section.malformedPrev ? undefined : section.prev;
    let hybridXRefStreamOffset: number | undefined;

    // Check for hybrid-reference: /XRefStm only applies to classic XRef tables.
    // Per PDF spec 1.5+, a table may have /XRefStm pointing to a supplemental
    // XRef stream. They belong to the SAME revision.
    if (isTable) {
      const xrefStmObj = section.trailer.entries.get("XRefStm");
      if (xrefStmObj !== undefined && xrefStmObj.type !== "number") {
        report({
          code: "malformed-xref-stm",
          message: `Malformed /XRefStm value in XRef section at offset ${currentPos}.`,
          position: currentPos,
        });
        truncated = true;
      } else if (xrefStmObj?.type === "number") {
        const xrefStmOffset = xrefStmObj.value;
        if (
          !Number.isSafeInteger(xrefStmOffset) ||
          xrefStmOffset < 0 ||
          xrefStmOffset >= buffer.length
        ) {
          report({
            code: "malformed-xref-stm",
            message: `Invalid /XRefStm offset ${xrefStmOffset} in XRef section at offset ${currentPos}.`,
            position: currentPos,
          });
          truncated = true;
        } else if (visitedOffsets.has(xrefStmOffset)) {
          report({
            code: "malformed-xref-stm",
            message: `Already visited /XRefStm offset ${xrefStmOffset} in XRef section at offset ${currentPos}.`,
            position: xrefStmOffset,
          });
          truncated = true;
        } else {
          try {
            visitedOffsets.add(xrefStmOffset);
            const supplementalSection = parseXRefSection(
              buffer,
              xrefStmOffset,
              limits,
              objectValueBudget,
            );
            if (supplementalSection.xrefStreamObject) {
              section.xrefStreamObject = supplementalSection.xrefStreamObject;
            }

            if (supplementalSection.malformedPrev) {
              report({
                code: "malformed-prev",
                message: `Malformed /Prev value in supplemental XRef section at offset ${xrefStmOffset}.`,
                position: xrefStmOffset,
              });
              truncated = true;
            }

            // Merge: primary wins, supplemental fills missing entries
            const merged = new Map(section.entries);
            for (const [objNum, entry] of supplementalSection.entries) {
              if (!merged.has(objNum)) {
                merged.set(objNum, entry);
              }
            }

            if (
              limits.maxObjects !== Infinity &&
              countLogicalXRefObjects(merged) > limits.maxObjects
            ) {
              report({
                code: "max-objects",
                message: `Hybrid XRef section contains more than ${limits.maxObjects} logical objects after merging /XRefStm.`,
                position: xrefStmOffset,
              });
              truncated = true;
            } else {
              section.entries = merged;
              hybridXRefStreamOffset = xrefStmOffset;
              // /Prev from the primary trailer per plan; do not fall back to supplemental
            }
          } catch (e) {
            truncated = true;
            if (e instanceof ObjectValueLimitError) {
              report({
                code: "max-object-values",
                message: e.message,
                position: xrefStmOffset,
              });
            } else {
              report({
                code: "hybrid-xref-stream",
                message: `Failed to parse hybrid XRef stream at offset ${xrefStmOffset}: ${e instanceof Error ? e.message : String(e)}`,
                position: xrefStmOffset,
              });
            }
          }
        }
      }
    }

    if (hybridXRefStreamOffset !== undefined) {
      section.hybridXRefStreamOffset = hybridXRefStreamOffset;
    }

    if (
      limits.maxXRefEntries !== Infinity &&
      (totalXRefEntries > limits.maxXRefEntries ||
        section.entries.size > limits.maxXRefEntries - totalXRefEntries)
    ) {
      report({
        code: "max-xref-entries",
        message: `Exceeded maximum retained XRef entries (${limits.maxXRefEntries}). Stopping the revision chain.`,
        position: currentPos,
      });
      truncated = true;
      break;
    }
    totalXRefEntries += section.entries.size;

    if (prev !== undefined) {
      section.prev = prev;
    } else {
      delete section.prev;
    }
    sections.push(section);
    logicalCount++;

    currentPos = prev;
  }

  if (logicalCount >= limits.maxSections && currentPos !== undefined) {
    report({
      code: "max-sections",
      message: `Exceeded maximum number of XRef sections (${limits.maxSections}). Stopping.`,
    });
    truncated = true;
  }

  return { sections, truncated };
}

function countLogicalXRefObjects(entries: XRefSection["entries"]): number {
  let count = 0;
  for (const objectNumber of entries.keys()) {
    if (objectNumber !== 0) count++;
  }
  return count;
}

/**
 * Parse single XRef section (table or stream)
 */
function parseXRefSection(
  buffer: Uint8Array,
  position: number,
  limits: ParseLimits,
  objectValueBudget: ObjectParseBudget,
): XRefSection {
  if (position < 0 || position >= buffer.length) {
    throw new Error(`XRef position ${position} is outside the input buffer`);
  }
  if (isXRefTable(buffer, position)) {
    return parseXRefTable(buffer, position, limits, objectValueBudget);
  }

  if (isXRefStream(buffer, position)) {
    return parseXRefStream(buffer, position, limits, objectValueBudget);
  }

  throw new Error(`Invalid XRef at position ${position}`);
}

function validateLimits(limits: ParseLimits): void {
  const names: (keyof ParseLimits)[] = [
    "maxFileBytes",
    "maxObjects",
    "maxXRefEntries",
    "maxSections",
    "maxDepth",
    "maxObjectValues",
    "maxStringBytes",
    "maxStreamBytes",
    "maxDecodedStreamBytes",
    "maxObjectVersions",
  ];
  for (const name of names) {
    const value = limits[name];
    if (value !== Infinity && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`Invalid ParseLimits.${name}: ${value}`);
    }
  }
}

// ============================================================================
// Object Access
// ============================================================================

/**
 * Get object by reference
 */
export function getObject(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0,
): PDFObject | null {
  const key = objectKey(objectNumber, generation);
  const entry = doc.objects.get(key);
  return entry?.value ?? null;
}

/**
 * Resolve a reference to its value.
 * Follows indirect references recursively with cycle detection and depth limit.
 */
export function resolveReference(doc: PDFDocument, obj: PDFObject): PDFObject {
  return resolveReferenceWithDepth(doc, obj, new Set<string>(), 0);
}

/**
 * Internal recursive reference resolver with cycle detection and depth tracking
 */
function resolveReferenceWithDepth(
  doc: PDFDocument,
  obj: PDFObject,
  visited: Set<string>,
  depth: number,
): PDFObject {
  const maxDepth = doc.history.limits.maxDepth;
  if (depth > maxDepth) {
    doc.diagnostics.push({
      code: "reference-depth",
      message: `Exceeded maximum reference resolution depth (${maxDepth}). Possible cycle.`,
    });
    return { type: "null" };
  }

  if (obj.type === "reference") {
    const refKey = objectKey(obj.objectNumber, obj.generation);

    // Cycle detection
    if (visited.has(refKey)) {
      doc.diagnostics.push({
        code: "reference-cycle",
        message: `Cyclic reference detected: ${refKey}. Returning null.`,
      });
      return { type: "null" };
    }

    visited.add(refKey);

    const resolved = getObject(doc, obj.objectNumber, obj.generation);
    if (resolved) {
      return resolveReferenceWithDepth(doc, resolved, visited, depth + 1);
    }

    return { type: "null" };
  }

  return obj;
}

/**
 * Get trailer dictionary (from most recent section)
 */
export function getTrailer(doc: PDFDocument): PDFDictionary | null {
  const section = doc.sections[0];
  return section?.trailer ?? null;
}

/**
 * Get document catalog
 */
export function getCatalog(doc: PDFDocument): PDFDictionary | null {
  const trailer = getTrailer(doc);
  if (!trailer) return null;

  const rootRef = trailer.entries.get("Root");
  if (rootRef?.type !== "reference") return null;

  const root = getObject(doc, rootRef.objectNumber, rootRef.generation);
  if (root?.type !== "dictionary") return null;

  return root;
}

/**
 * Get document info dictionary
 */
export function getInfo(doc: PDFDocument): PDFDictionary | null {
  const trailer = getTrailer(doc);
  if (!trailer) return null;

  const infoRef = trailer.entries.get("Info");
  if (infoRef?.type !== "reference") return null;

  const info = getObject(doc, infoRef.objectNumber, infoRef.generation);
  if (info?.type !== "dictionary") return null;

  return info;
}
