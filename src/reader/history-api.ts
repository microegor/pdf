/**
 * Public History & Revision API
 *
 * Exports functions for:
 *   - Written-version enumeration and materialization
 *   - Revision-snapshot access (getObjectAtRevision)
 *   - Revision-aware reference resolution
 *   - Object lifecycle information
 */

import { decodePDFString } from './encoding.js';
import { getObjectAtRevision as coreGetObjectAtRevision, materializeVersion } from './history.js';
import type {
  IndirectObject,
  ObjectLifecycle,
  ObjectVersionDescriptor,
  ObjectVersionLocator,
  PDFDocument,
  PDFObject,
  RevisionMetadata,
} from './types.js';
import { ObjectVersionParseError, objectKey, objectVersionKey } from './types.js';

// ============================================================================
// Written-Version APIs
// ============================================================================

/**
 * Get lightweight descriptors for all written versions of an object identity.
 * Does not materialize (parse) any objects.
 */
export function getObjectVersionDescriptors(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0
): readonly ObjectVersionDescriptor[] {
  const events = doc.history.eventsByObject.get(objectNumber);
  if (!events) return [];

  const descriptors: ObjectVersionDescriptor[] = [];
  let versionIndex = 0;

  for (const [eventIndex, event] of events.entries()) {
    if (event.kind === 'version' && event.generation === generation) {
      descriptors.push({
        objectNumber: event.objectNumber,
        generation: event.generation,
        versionIndex,
        eventIndex,
        sectionIndex: event.sectionIndex,
        revisionIndex: event.revisionIndex,
      });
      versionIndex++;
    }
  }

  return descriptors;
}

/**
 * Get the number of written versions for an object identity.
 * Does not materialize any objects.
 */
export function getObjectVersionCount(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0
): number {
  const events = doc.history.eventsByObject.get(objectNumber);
  if (!events) return 0;

  let count = 0;
  for (const event of events) {
    if (event.kind === 'version' && event.generation === generation) {
      count++;
    }
  }
  return count;
}

/**
 * Materialize and return all written versions of an object identity,
 * ordered oldest → newest.
 *
 * A malformed version raises ObjectVersionParseError rather than being
 * silently omitted. The error's cause contains the underlying parse error.
 */
export function getObjectHistory(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0
): readonly IndirectObject[] {
  const descriptors = getObjectVersionDescriptors(doc, objectNumber, generation);
  const result: IndirectObject[] = [];

  for (const desc of descriptors) {
    try {
      result.push(materializeVersionByDescriptor(doc, desc));
    } catch (e) {
      throw new ObjectVersionParseError(desc, e);
    }
  }

  return result;
}

/**
 * Materialize a specific written version by ordinal index.
 *
 * Returns null only for an out-of-range version index.
 * Raises ObjectVersionParseError on parse failure — the error's cause
 * contains the underlying parse error with offset and buffer details.
 */
export function getObjectVersion(
  doc: PDFDocument,
  objectNumber: number,
  generation: number,
  versionIndex: number
): IndirectObject | null {
  const descriptors = getObjectVersionDescriptors(doc, objectNumber, generation);

  if (versionIndex < 0 || versionIndex >= descriptors.length) {
    return null;
  }

  const desc = descriptors[versionIndex];
  if (!desc) return null;

  try {
    return materializeVersionByDescriptor(doc, desc);
  } catch (e) {
    throw new ObjectVersionParseError(desc, e);
  }
}

/**
 * Internal helper: materialize a version from its descriptor.
 * Throws on parse failure (never returns null for a found locator).
 */
function materializeVersionByDescriptor(
  doc: PDFDocument,
  descriptor: ObjectVersionDescriptor
): IndirectObject {
  const events = doc.history.eventsByObject.get(descriptor.objectNumber);
  if (!events) {
    throw new Error(`No history events for object ${descriptor.objectNumber}`);
  }

  const event = events[descriptor.eventIndex];
  if (
    event?.kind === 'version' &&
    event.generation === descriptor.generation &&
    event.revisionIndex === descriptor.revisionIndex
  ) {
    return materializeVersion(doc, event as ObjectVersionLocator);
  }

  throw new Error(
    `Version descriptor not found in history: ` +
      `obj ${descriptor.objectNumber} gen ${descriptor.generation} ` +
      `v${descriptor.versionIndex} rev ${descriptor.revisionIndex}`
  );
}

// ============================================================================
// Revision Snapshot API
// ============================================================================

/**
 * Get the object value effective at a specific chronological revision.
 *
 * Replays the object's history events up to revisionIndex, respecting
 * free/reuse events. Returns null if the requested identity is not active
 * at that revision.
 */
export function getObjectAtRevision(
  doc: PDFDocument,
  objectNumber: number,
  generation: number,
  revisionIndex: number
): IndirectObject | null {
  return coreGetObjectAtRevision(doc, objectNumber, generation, revisionIndex);
}

// ============================================================================
// Revision-Aware Reference Resolution
// ============================================================================

/**
 * Resolve a PDF reference against a specific revision.
 *
 * Unlike resolveReference() which always resolves against the newest document,
 * this function uses getObjectAtRevision() so that references are resolved
 * in historical context.
 */
export function resolveReferenceAtRevision(
  doc: PDFDocument,
  value: PDFObject,
  revisionIndex: number
): PDFObject {
  return resolveRefAtRevisionWithDepth(doc, value, revisionIndex, new Set<string>(), 0);
}

function resolveRefAtRevisionWithDepth(
  doc: PDFDocument,
  obj: PDFObject,
  revisionIndex: number,
  visited: Set<string>,
  depth: number
): PDFObject {
  const maxDepth = doc.history.limits.maxDepth;
  if (depth > maxDepth) {
    doc.diagnostics.push({
      code: 'reference-depth',
      message: `Exceeded maximum reference resolution depth (${maxDepth}). Possible cycle.`,
    });
    return { type: 'null' };
  }

  if (obj.type === 'reference') {
    const refKey = objectKey(obj.objectNumber, obj.generation);

    if (visited.has(refKey)) {
      doc.diagnostics.push({
        code: 'reference-cycle',
        message: `Cyclic reference detected: ${refKey}. Returning null.`,
      });
      return { type: 'null' };
    }

    visited.add(refKey);

    const resolved = getObjectAtRevision(doc, obj.objectNumber, obj.generation, revisionIndex);
    if (resolved) {
      return resolveRefAtRevisionWithDepth(doc, resolved.value, revisionIndex, visited, depth + 1);
    }

    return { type: 'null' };
  }

  return obj;
}

// ============================================================================
// Object Lifecycle
// ============================================================================

/**
 * Get lifecycle information for an object identity.
 *
 * Summarizes creation, last-write, free status, and version count
 * without materializing all versions.
 */
export function getObjectLifecycle(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0
): ObjectLifecycle | null {
  const events = doc.history.eventsByObject.get(objectNumber);
  if (!events) return null;

  let versionCount = 0;
  let createdInRevision = -1;
  let lastWrittenInRevision = -1;
  let freedInRevision: number | undefined;
  let isCurrent = false;

  // Replay lifecycle by object number, tracking which generation is active.
  // A free event only affects the generation that was active at that point.
  let activeGeneration: number | null = null;

  for (const event of events) {
    if (event.kind === 'version') {
      activeGeneration = event.generation;

      if (event.generation === generation) {
        if (createdInRevision < 0) {
          createdInRevision = event.revisionIndex;
        }
        lastWrittenInRevision = event.revisionIndex;
        versionCount++;
      }
    }
    if (event.kind === 'free') {
      // Free event closes only the generation active before it
      if (activeGeneration === generation && freedInRevision === undefined) {
        freedInRevision = event.revisionIndex;
      }
      activeGeneration = null;
    }
  }

  // Check if this identity is currently active
  const key = objectKey(objectNumber, generation);
  isCurrent = doc.objects.has(key);

  if (versionCount === 0) return null;

  return {
    objectNumber,
    generation,
    versionCount,
    isCurrent,
    createdInRevision,
    lastWrittenInRevision,
    freedInRevision,
    historyComplete: doc.history.complete,
  };
}

/**
 * Get lifecycle summaries for all object identities in the document.
 * This includes both current objects and freed histories.
 */
export function getAllObjectLifecycles(doc: PDFDocument): readonly ObjectLifecycle[] {
  const seen = new Set<string>();
  const results: ObjectLifecycle[] = [];

  // Collect from eventsByObject (has freed histories too)
  for (const [objNum, events] of doc.history.eventsByObject) {
    const generations = new Set<number>();
    for (const event of events) {
      if (event.kind === 'version') {
        generations.add(event.generation);
      }
    }

    for (const gen of generations) {
      const key = `${objNum}_${gen}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lifecycle = getObjectLifecycle(doc, objNum, gen);
      if (lifecycle) {
        results.push(lifecycle);
      }
    }
  }

  // Also include current objects that may not have history events
  // (e.g., single-revision documents)
  for (const key of doc.objects.keys()) {
    if (seen.has(key)) continue;
    seen.add(key);

    const parts = key.split('_');
    const objNum = parseInt(parts[0] ?? '0', 10);
    const gen = parseInt(parts[1] ?? '0', 10);

    const lifecycle = getObjectLifecycle(doc, objNum, gen);
    if (lifecycle) {
      results.push(lifecycle);
    }
  }

  return results;
}

// ============================================================================
// Revision Metadata
// ============================================================================

/**
 * Get the trailer dictionary effective at a given revision.
 * Falls back through /Prev chain if the key is not present in the current trailer.
 */
function getEffectiveTrailerValue(
  doc: PDFDocument,
  revisionIndex: number,
  key: string
): PDFObject | null {
  const sectionIndex = doc.sections.length - 1 - revisionIndex;

  // Search from current section toward OLDER revisions (higher section indexes),
  // not toward newer ones. doc.sections is newest → oldest.
  for (let si = sectionIndex; si < doc.sections.length; si++) {
    const section = doc.sections[si];
    if (!section) continue;

    const value = section.trailer.entries.get(key);
    if (value) return value;
  }

  return null;
}

/**
 * Extract revision metadata from the trailer /Info dictionary.
 * Best-effort: missing or malformed metadata never fails.
 */
export function extractRevisionMetadata(
  doc: PDFDocument,
  revisionIndex: number
): RevisionMetadata | undefined {
  const infoRef = getEffectiveTrailerValue(doc, revisionIndex, 'Info');
  const meta: RevisionMetadata = {};

  // Extract /ID from trailer independently of /Info (P2-2)
  const idObj = getEffectiveTrailerValue(doc, revisionIndex, 'ID');
  if (idObj?.type === 'array' && idObj.items.length >= 2) {
    const perm = idObj.items[0];
    const rev = idObj.items[1];
    const permRaw = perm?.type === 'string' || perm?.type === 'hexstring' ? perm.raw : null;
    const revRaw = rev?.type === 'string' || rev?.type === 'hexstring' ? rev.raw : null;
    if (permRaw && revRaw) {
      meta.fileId = {
        permanent: bytesToHex(permRaw),
        revision: bytesToHex(revRaw),
      };
    }
  }

  // Resolve /Info if present
  if (infoRef?.type !== 'reference') {
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  const infoObj = getObjectAtRevision(doc, infoRef.objectNumber, infoRef.generation, revisionIndex);
  if (infoObj?.value.type !== 'dictionary') {
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  const dict = infoObj.value;

  // /ModDate
  const modDate = dict.entries.get('ModDate');
  if (modDate && (modDate.type === 'string' || modDate.type === 'hexstring')) {
    const raw = decodePDFStringRaw(modDate.raw);
    meta.modifiedDate = {
      raw,
      iso: tryParsePDFDate(raw),
    };
  }

  // /Producer
  const producer = dict.entries.get('Producer');
  if (producer && (producer.type === 'string' || producer.type === 'hexstring')) {
    meta.producer = decodePDFStringRaw(producer.raw);
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Alias for extractRevisionMetadata — canonical name per spec.
 * @see extractRevisionMetadata
 */
export const getRevisionMetadata = extractRevisionMetadata;

// ============================================================================
// Helpers
// ============================================================================

function decodePDFStringRaw(raw: Uint8Array): string {
  return decodePDFString(raw);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Try to parse a PDF date string to ISO 8601.
 * PDF dates are in the format: D:YYYYMMDDHHmmSSOHH'mm'
 * Returns undefined for unparseable dates.
 */
function tryParsePDFDate(raw: string): string | undefined {
  // Strip the leading "D:" prefix
  let dateStr = raw;
  if (dateStr.startsWith('D:')) {
    dateStr = dateStr.substring(2);
  }

  // Extract components
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(8, 10);
  const min = dateStr.substring(10, 12);
  const sec = dateStr.substring(12, 14);

  if (year.length !== 4) return undefined;

  // Build ISO string
  let iso = `${year}`;
  if (month) iso += `-${month}`;
  if (day) iso += `-${day}`;
  if (hour) iso += `T${hour}`;
  if (min) iso += `:${min}`;
  if (sec) iso += `:${sec}`;

  // Timezone offset
  const tzMatch = dateStr.substring(14).match(/^([+-]\d{2})'(\d{2})'/);
  if (tzMatch) {
    iso += `${tzMatch[1]}:${tzMatch[2]}`;
  } else {
    iso += 'Z'; // Assume UTC if no timezone
  }

  return iso;
}

// ============================================================================
// Section Helpers (Updated)
// ============================================================================

/**
 * Get objects written in a specific section (by sectionIndex, newest = 0).
 * Updated to include historical versions, not only currently active objects.
 */
export function getObjectsInSection(doc: PDFDocument, sectionIndex: number): IndirectObject[] {
  // Validate sectionIndex
  if (sectionIndex < 0 || sectionIndex >= doc.sections.length) {
    return [];
  }

  const result: IndirectObject[] = [];
  const seenKeys = new Set<string>();

  // Collect from history: find version events written in this section
  for (const [, events] of doc.history.eventsByObject) {
    for (const event of events) {
      if (event.kind === 'version' && event.sectionIndex === sectionIndex) {
        const locator = event as ObjectVersionLocator;
        try {
          const version = materializeVersion(doc, locator);
          const ri = version.revisionIndex ?? locator.revisionIndex;
          const key = objectVersionKey(version.objectNumber, version.generation, ri);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            result.push(version);
          }
        } catch (_e) {
          // Skip versions that fail to materialize
        }
      }
    }
  }

  return result;
}
