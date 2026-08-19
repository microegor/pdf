/**
 * Object History Module
 *
 * Builds and manages the object-history index for PDF documents.
 * Separates the concepts of:
 *   1. Raw XRef sources → normalized into logical revisions
 *   2. History events (version locators + free events) ordered oldest→newest
 *   3. Current object state (newest active objects only)
 *
 * Key design decisions:
 *   - History events are built scanning revisions oldest→newest
 *   - Current state is built scanning newest→oldest
 *   - Free events remove from current state but don't erase older versions
 *   - Repeated XRef declarations of the same physical bytes don't create duplicates
 *   - Compressed objects' version identity includes the containing object stream version
 */

import { createCursor } from './buffer.js';
import { ObjectValueLimitError, parseIndirectObject, parseObject } from './objects.js';
import { decodeStream } from './stream.js';
import type {
  IndirectObject,
  ObjectFreeEvent,
  ObjectHistoryEvent,
  ObjectHistoryIndex,
  ObjectParseBudget,
  ObjectVersionLocator,
  ParseDiagnostic,
  ParseLimits,
  PDFDocument,
  PDFObject,
  PDFStream,
  XRefEntry,
  XRefEntryCompressed,
} from './types.js';
import {
  createObjectParseBudget,
  DEFAULT_PARSE_LIMITS,
  objectKey,
  objectVersionKey,
} from './types.js';

type DiagnosticReporter = (diagnostic: ParseDiagnostic) => void;
type PreparsedIndirectObject = Pick<IndirectObject, 'objectNumber' | 'generation' | 'value'>;
type EffectiveObjectState = {
  sourceKey: string;
  generation: number;
  isFree: boolean;
  entry: XRefEntry;
};
type CompressedObjectIndex = Map<number, Map<number, EffectiveObjectState>>;

// ============================================================================
// Source Key Computation
// ============================================================================

/**
 * Compute a stable source key for an XRef entry.
 * Two entries pointing to the same physical bytes share the same key.
 */
export function computeEntrySourceKey(
  entry: XRefEntry,
  objectStreamSourceKey?: string,
  revisionIndex?: number
): string {
  if (entry.type === 'free') {
    return `free:${entry.generation}`;
  }
  if (entry.type === 'used') {
    return `used:${entry.offset}:${entry.generation}`;
  }
  // compressed: identity depends on containing stream version.
  // If the stream's source is unknown, use a revision-scoped key so
  // distinct declarations are not collapsed.
  if (objectStreamSourceKey) {
    return `compressed:${entry.objectStreamNumber}@${objectStreamSourceKey}:${entry.indexInStream}`;
  }
  // Unresolvable stream source — include stream number + index only,
  // but mark as incomplete. The plan requires this to be diagnosed.
  // We set complete = false when this path is hit (handled in buildHistoryIndex).
  const scope = revisionIndex === undefined ? 'unknown' : String(revisionIndex);
  return `compressed-unknown:${entry.objectStreamNumber}:${entry.indexInStream}@${scope}`;
}

// ============================================================================
// History Building
// ============================================================================

/**
 * Build the object history index from normalized logical revisions.
 *
 * Scans revisions oldest→newest, maintaining effective XRef state per object number.
 * Only emits history events when the effective physical version or free state changes.
 */
export function buildHistoryIndex(doc: PDFDocument, limits: ParseLimits): ObjectHistoryIndex {
  const sections = doc.sections;
  const objectValueBudget = getObjectValueBudget(doc, limits);
  const eventsByObject = new Map<number, ObjectHistoryEvent[]>();
  let totalEvents = 0;
  let complete = true;
  let incompleteReason: string | undefined;

  // Effective state: objectNumber → { sourceKey, generation, isFree, entry }
  const effectiveState = new Map<number, EffectiveObjectState>();
  // Reverse index kept in sync with effectiveState to avoid scanning all
  // effective objects again for every revision.
  const compressedObjectsByStream: CompressedObjectIndex = new Map();

  // Scan oldest → newest (chronological)
  for (let ri = 0; ri < sections.length; ri++) {
    // sectionIndex = newest→oldest, revisionIndex = oldest→newest
    const sectionIndex = sections.length - 1 - ri;
    const section = sections[sectionIndex];
    if (!section) continue;

    // First pass: collect all entries for this revision and compute
    // object-stream source keys (needed for compressed entry keys)
    const entriesThisRevision = new Map<number, XRefEntry>();
    for (const [objNum, entry] of section.entries) {
      entriesThisRevision.set(objNum, entry);
    }

    // Compute source keys for entries in this revision
    const sourceKeys = new Map<number, string>();
    for (const [objNum, entry] of entriesThisRevision) {
      let streamSourceKey: string | undefined;
      if (entry.type === 'compressed') {
        // Look up the object stream's effective source key
        const streamState = effectiveState.get(entry.objectStreamNumber);
        if (streamState && !streamState.isFree) {
          streamSourceKey = streamState.sourceKey;
        }
        // If the object stream itself was written in this revision, use its new key
        const streamEntry = entriesThisRevision.get(entry.objectStreamNumber);
        if (streamEntry) {
          streamSourceKey =
            streamEntry.type === 'free' ? undefined : computeEntrySourceKey(streamEntry, undefined);
        }
        if (!streamSourceKey) {
          complete = false;
          incompleteReason ??= `Object stream source for compressed object ${objNum} could not be resolved.`;
        }
      }
      sourceKeys.set(objNum, computeEntrySourceKey(entry, streamSourceKey, ri));
    }

    // Second pass: compute transitions and emit events
    const changedObjectStreams = new Map<
      number,
      { sourceKey: string | undefined; isFree: boolean }
    >();
    for (const [objNum, entry] of entriesThisRevision) {
      // Skip object number 0 — its permanent free entry wastes budget
      if (objNum === 0) continue;

      const newKey = sourceKeys.get(objNum);
      if (newKey === undefined) continue;

      const prev = effectiveState.get(objNum);
      const isFreeEntry = entry.type === 'free';
      const newGen = isFreeEntry
        ? entry.generation
        : entry.type === 'compressed'
          ? 0
          : entry.generation;

      // Check if state actually changed
      const stateChanged = !prev || prev.sourceKey !== newKey || prev.isFree !== isFreeEntry;

      if (stateChanged) {
        // Check limits
        if (totalEvents >= limits.maxObjectVersions) {
          complete = false;
          incompleteReason ??= `Maximum object history event limit (${limits.maxObjectVersions}) reached.`;
          break;
        }

        const event = isFreeEntry
          ? createFreeEvent(objNum, entry, sectionIndex, ri)
          : createVersionLocator(objNum, entry, sectionIndex, ri, newKey);

        pushEvent(eventsByObject, objNum, event);
        totalEvents++;

        // Update effective state
        if (prev?.entry.type === 'compressed') {
          removeCompressedObject(compressedObjectsByStream, prev.entry, objNum);
        }
        const nextState: EffectiveObjectState = {
          sourceKey: newKey,
          generation: newGen,
          isFree: isFreeEntry,
          entry,
        };
        effectiveState.set(objNum, nextState);
        if (entry.type === 'compressed') {
          addCompressedObject(compressedObjectsByStream, objNum, nextState);
        }
        changedObjectStreams.set(objNum, {
          sourceKey: isFreeEntry ? undefined : newKey,
          isFree: isFreeEntry,
        });
      }
    }

    if (!complete) break;

    // Rewriting an object stream implicitly rewrites every compressed object
    // that remains effective from that stream, even when the new XRef section
    // does not repeat each type-2 entry.
    for (const [streamNumber, streamState] of changedObjectStreams) {
      const objectsInStream = compressedObjectsByStream.get(streamNumber);
      if (!objectsInStream) continue;

      for (const [objNum, objectState] of objectsInStream) {
        if (objectState.isFree) continue;

        if (streamState.isFree || !streamState.sourceKey) {
          complete = false;
          incompleteReason ??= `Object stream ${streamNumber} was freed while compressed object ${objNum} remained effective.`;
          continue;
        }

        const compressedEntry = objectState.entry;
        if (compressedEntry.type !== 'compressed') continue;
        const sourceKey = computeEntrySourceKey(compressedEntry, streamState.sourceKey, ri);
        if (objectState.sourceKey === sourceKey) continue;

        if (totalEvents >= limits.maxObjectVersions) {
          complete = false;
          incompleteReason ??= `Maximum object history event limit (${limits.maxObjectVersions}) reached.`;
          break;
        }

        pushEvent(
          eventsByObject,
          objNum,
          createVersionLocator(objNum, compressedEntry, sectionIndex, ri, sourceKey)
        );
        totalEvents++;
        objectState.sourceKey = sourceKey;
        const effectiveObjectState = effectiveState.get(objNum);
        if (effectiveObjectState) effectiveObjectState.sourceKey = sourceKey;
      }
      if (!complete) break;
    }

    if (!complete) break;

    // Objects NOT in this revision: state carries forward automatically (no event needed)
  }

  return {
    eventsByObject,
    versionCache: new Map(),
    complete,
    ...(incompleteReason ? { incompleteReason } : {}),
    limits,
    objectValueBudget,
    materializingKeys: new Set(),
    parsedStreamCache: new Map(),
  };
}

function createVersionLocator(
  objectNumber: number,
  entry: XRefEntry,
  sectionIndex: number,
  revisionIndex: number,
  sourceKey: string
): ObjectVersionLocator {
  if (entry.type === 'free') {
    throw new Error('Internal error: free entry passed to createVersionLocator');
  }
  return {
    kind: 'version',
    objectNumber,
    generation: entry.type === 'compressed' ? 0 : entry.generation,
    sectionIndex,
    revisionIndex,
    entry: entry as ObjectVersionLocator['entry'],
    sourceKey,
  };
}

function createFreeEvent(
  objectNumber: number,
  entry: XRefEntry,
  sectionIndex: number,
  revisionIndex: number
): ObjectFreeEvent {
  if (entry.type !== 'free') {
    throw new Error('Internal error: non-free entry passed to createFreeEvent');
  }
  return {
    kind: 'free',
    objectNumber,
    nextGeneration: entry.generation,
    sectionIndex,
    revisionIndex,
  };
}

function pushEvent(
  eventsByObject: Map<number, ObjectHistoryEvent[]>,
  objectNumber: number,
  event: ObjectHistoryEvent
): void {
  let events = eventsByObject.get(objectNumber);
  if (!events) {
    events = [];
    eventsByObject.set(objectNumber, events);
  }
  // Ensure events stay ordered oldest→newest (we iterate oldest→newest,
  // so push maintains order)
  events.push(event);
}

function addCompressedObject(
  index: CompressedObjectIndex,
  objectNumber: number,
  state: EffectiveObjectState
): void {
  if (state.entry.type !== 'compressed') return;
  let objectsInStream = index.get(state.entry.objectStreamNumber);
  if (!objectsInStream) {
    objectsInStream = new Map();
    index.set(state.entry.objectStreamNumber, objectsInStream);
  }
  objectsInStream.set(objectNumber, state);
}

function removeCompressedObject(
  index: CompressedObjectIndex,
  entry: XRefEntryCompressed,
  objectNumber: number
): void {
  const objectsInStream = index.get(entry.objectStreamNumber);
  if (!objectsInStream) return;
  objectsInStream.delete(objectNumber);
  if (objectsInStream.size === 0) index.delete(entry.objectStreamNumber);
}

function addDiagnostic(
  doc: PDFDocument,
  reporter: DiagnosticReporter | undefined,
  diagnostic: ParseDiagnostic
): void {
  if (reporter) {
    reporter(diagnostic);
  } else {
    doc.diagnostics.push(diagnostic);
  }
}

function addObjectValueLimitDiagnostic(
  doc: PDFDocument,
  reporter: DiagnosticReporter | undefined,
  error: ObjectValueLimitError,
  position?: number
): void {
  if (doc.diagnostics.some(diagnostic => diagnostic.code === 'max-object-values')) return;
  addDiagnostic(doc, reporter, {
    code: 'max-object-values',
    message: `${error.message}. Stopping object materialization.`,
    ...(position === undefined ? {} : { position }),
  });
}

/**
 * Return the document-wide direct-value budget, creating it for manually
 * assembled PDFDocument fixtures and older callers that omit the field.
 */
function getObjectValueBudget(doc: PDFDocument, limits: ParseLimits): ObjectParseBudget {
  const existing = doc.history.objectValueBudget;
  if (existing) return existing;

  const created = createObjectParseBudget(limits.maxObjectValues);
  doc.history.objectValueBudget = created;
  return created;
}

function collectPreparsedXRefStreamObjects(doc: PDFDocument): Map<number, PreparsedIndirectObject> {
  const result = new Map<number, PreparsedIndirectObject>();
  for (const section of doc.sections) {
    const source = section.xrefStreamObject;
    if (source) result.set(source.offset, source);
  }
  return result;
}

function findPreparsedXRefStreamObject(
  doc: PDFDocument,
  offset: number
): PreparsedIndirectObject | undefined {
  for (const section of doc.sections) {
    const source = section.xrefStreamObject;
    if (source?.offset === offset) return source;
  }
  return undefined;
}

/**
 * Store an eagerly materialized current object in both caches. The history API
 * can then return the current version without parsing its bytes a second time
 * or consuming the document-wide value budget again.
 */
function storeCurrentObject(doc: PDFDocument, object: IndirectObject): void {
  doc.objects.set(objectKey(object.objectNumber, object.generation), object);
  if (object.revisionIndex !== undefined) {
    doc.history.versionCache.set(
      objectVersionKey(object.objectNumber, object.generation, object.revisionIndex),
      object
    );
  }
}

// ============================================================================
// Current State Building
// ============================================================================

/**
 * Build the current (newest) object state.
 *
 * Scans revisions newest→oldest and accepts the first entry for each objectNumber.
 * Free entries are kept to block resurrection of older versions but are NOT
 * materialized into doc.objects.
 */
export function buildCurrentState(
  doc: PDFDocument,
  limits: ParseLimits,
  reporter?: DiagnosticReporter
): boolean {
  const objectValueBudget = getObjectValueBudget(doc, limits);
  const preparsedXRefStreamObjects = collectPreparsedXRefStreamObjects(doc);
  // Keyed by objectNumber only (not generation). The newest entry wins,
  // regardless of type (free or active). Never overwrite once set.
  const newestByObject = new Map<number, { entry: XRefEntry; sectionIndex: number }>();

  // Scan newest → oldest
  for (let si = 0; si < doc.sections.length; si++) {
    const section = doc.sections[si];
    if (!section) continue;

    for (const [objectNumber, entry] of section.entries) {
      // Skip object number 0 (always free, never materialized)
      if (objectNumber === 0 || newestByObject.has(objectNumber)) continue;
      newestByObject.set(objectNumber, { entry, sectionIndex: si });
    }
  }

  // Materialize only active entries
  let complete = true;
  let objectValueLimitReached = false;
  for (const [objectNumber, { entry, sectionIndex }] of newestByObject) {
    if (entry.type === 'free') {
      // Object is freed in the newest revision — not in doc.objects.
      // History events still retain older versions.
      continue;
    }

    if (doc.objects.size >= limits.maxObjects) {
      addDiagnostic(doc, reporter, {
        code: 'max-objects',
        message: `Exceeded maximum number of objects (${limits.maxObjects}). Stopping.`,
      });
      complete = false;
      break;
    }

    const revisionIndex = doc.sections.length - 1 - sectionIndex;
    // For used entries, generation comes from the entry itself.
    // For compressed entries, generation is always 0.
    const generation = entry.type === 'compressed' ? 0 : entry.generation;
    const key = objectKey(objectNumber, generation);

    // P1-5: find the canonical history locator for this physical version.
    // The newest XRef declaration may repeat an older offset; the history
    // index deduplicates by sourceKey, so the locator's sectionIndex/revisionIndex
    // describe the actual physical write, not the newest declaration.
    const sourceKey =
      entry.type === 'compressed'
        ? findHistorySourceKey(doc, objectNumber, entry, revisionIndex)
        : computeEntrySourceKey(entry);
    let physicalSectionIndex = sectionIndex;
    let physicalRevisionIndex = revisionIndex;
    const eventsForObj = doc.history.eventsByObject.get(objectNumber);
    if (eventsForObj) {
      for (const event of eventsForObj) {
        if (
          event.kind === 'version' &&
          event.sourceKey === sourceKey &&
          event.generation === generation
        ) {
          physicalSectionIndex = event.sectionIndex;
          physicalRevisionIndex = event.revisionIndex;
          break;
        }
      }
    }

    if (entry.type === 'used') {
      try {
        if (entry.offset < 0 || entry.offset >= doc.buffer.length) {
          addDiagnostic(doc, reporter, {
            code: 'object-offset',
            message: `XRef entry for object ${key} has out-of-bounds offset ${entry.offset}. Skipping.`,
            position: entry.offset,
          });
          complete = false;
          continue;
        }

        const indirectObj =
          preparsedXRefStreamObjects.get(entry.offset) ??
          parseIndirectObject(createCursor(doc.buffer, entry.offset), limits, objectValueBudget);

        // P0-1: validate identity before storing
        if (indirectObj.objectNumber !== objectNumber || indirectObj.generation !== generation) {
          addDiagnostic(doc, reporter, {
            code: 'object-identity',
            message:
              `Object at offset ${entry.offset} has unexpected identity: ` +
              `expected ${objectNumber} ${generation}, ` +
              `got ${indirectObj.objectNumber} ${indirectObj.generation}. Skipping.`,
            position: entry.offset,
          });
          complete = false;
          continue;
        }

        storeCurrentObject(doc, {
          objectNumber: indirectObj.objectNumber,
          generation: indirectObj.generation,
          value: indirectObj.value,
          sectionIndex: physicalSectionIndex,
          revisionIndex: physicalRevisionIndex,
        });
      } catch (e) {
        complete = false;
        if (e instanceof ObjectValueLimitError) {
          addObjectValueLimitDiagnostic(doc, reporter, e, entry.offset);
          objectValueLimitReached = true;
          break;
        }
        addDiagnostic(doc, reporter, {
          code: 'object-parse',
          message: `Failed to parse object ${key} at offset ${entry.offset}: ${e instanceof Error ? e.message : String(e)}`,
          position: entry.offset,
        });
      }
    }
    // Compressed objects are handled after the used-object pass
  }

  // Handle compressed objects — pass newestByObject for proper filtering
  if (!objectValueLimitReached) {
    complete = parseCompressedObjectsNew(doc, newestByObject, limits, reporter) && complete;
  }

  // Attach revisionIndex to objects that don't have it yet
  for (const [, obj] of doc.objects) {
    if (obj.revisionIndex === undefined || obj.revisionIndex < 0) {
      (obj as Record<string, unknown>).revisionIndex = doc.sections.length - 1 - obj.sectionIndex;
    }
  }
  return complete;
}

function findHistorySourceKey(
  doc: PDFDocument,
  objectNumber: number,
  entry: XRefEntryCompressed,
  targetRevisionIndex: number
): string {
  const events = doc.history.eventsByObject.get(objectNumber) ?? [];
  let best: ObjectVersionLocator | undefined;
  for (const event of events) {
    if (
      event.kind === 'version' &&
      event.entry.type === 'compressed' &&
      event.entry.objectStreamNumber === entry.objectStreamNumber &&
      event.entry.indexInStream === entry.indexInStream &&
      event.revisionIndex <= targetRevisionIndex &&
      (!best || event.revisionIndex > best.revisionIndex)
    ) {
      best = event;
    }
  }
  return best?.sourceKey ?? computeEntrySourceKey(entry, undefined, targetRevisionIndex);
}

/**
 * Parse compressed objects using the newest object stream version.
 * Only processes entries that are the newest per objectNumber.
 */
function parseCompressedObjectsNew(
  doc: PDFDocument,
  newestByObject: Map<number, { entry: XRefEntry; sectionIndex: number }>,
  limits: ParseLimits,
  reporter?: DiagnosticReporter
): boolean {
  let complete = true;
  const objectValueBudget = getObjectValueBudget(doc, limits);
  // Filter to compressed entries only, respecting newest-first selection
  const compressedByObjNum = new Map<
    number,
    { entry: XRefEntryCompressed; sectionIndex: number }
  >();
  for (const [objectNumber, { entry, sectionIndex }] of newestByObject) {
    if (entry.type === 'compressed' && !doc.objects.has(objectKey(objectNumber, 0))) {
      compressedByObjNum.set(objectNumber, { entry, sectionIndex });
    }
  }

  // Group by object stream number
  const byStream = new Map<number, { objNum: number; index: number; sectionIndex: number }[]>();
  for (const [objectNumber, { entry, sectionIndex }] of compressedByObjNum) {
    let list = byStream.get(entry.objectStreamNumber);
    if (!list) {
      list = [];
      byStream.set(entry.objectStreamNumber, list);
    }
    list.push({ objNum: objectNumber, index: entry.indexInStream, sectionIndex });
  }

  for (const [streamNum, objects] of byStream) {
    const streamKey = objectKey(streamNum, 0);
    const streamObj = doc.objects.get(streamKey);

    if (!streamObj) {
      addDiagnostic(doc, reporter, {
        code: 'object-stream-missing',
        message: `Object stream ${streamNum} is missing while materializing compressed objects.`,
      });
      complete = false;
      continue;
    }

    if (streamObj.value.type !== 'stream') {
      addDiagnostic(doc, reporter, {
        code: 'object-stream-type',
        message: `Object ${streamNum} referenced as an object stream has type ${streamObj.value.type}.`,
      });
      complete = false;
      continue;
    }

    const typeEntry = streamObj.value.dictionary.entries.get('Type');
    if (typeEntry?.type !== 'name' || typeEntry.value !== 'ObjStm') {
      addDiagnostic(doc, reporter, {
        code: 'object-stream-type',
        message: `Object stream ${streamNum} is missing /Type /ObjStm.`,
      });
      complete = false;
      continue;
    }

    try {
      const parsedItems = parseObjectStreamRetainNumbers(
        streamObj.value,
        limits,
        objectValueBudget
      );

      for (const { objNum, index, sectionIndex } of objects) {
        if (doc.objects.size >= limits.maxObjects) {
          addDiagnostic(doc, reporter, {
            code: 'max-objects',
            message: `Exceeded maximum number of objects (${limits.maxObjects}) while materializing object stream ${streamNum}.`,
          });
          complete = false;
          break;
        }

        const item = parsedItems[index];
        if (!item) {
          addDiagnostic(doc, reporter, {
            code: 'object-stream-index',
            message: `Object stream ${streamNum} has no item at index ${index}.`,
          });
          complete = false;
          continue;
        }

        // P0-2: validate embedded object number matches
        if (item.objectNumber !== objNum) {
          complete = false;
          addDiagnostic(doc, reporter, {
            code: 'object-stream-identity',
            message: `Object stream ${streamNum} index ${index}: embedded number ${item.objectNumber} ≠ expected ${objNum}. Skipping.`,
          });
          continue;
        }

        // P1-5: find physical write revision from history locator
        const entryData = compressedByObjNum.get(objNum);
        const entrySourceKey = entryData
          ? findHistorySourceKey(
              doc,
              objNum,
              entryData.entry,
              // The current state always uses the newest object stream. If
              // its compressed entry was inherited from an older XRef section,
              // resolve the locator against the newest revision so an implicit
              // ObjStm rewrite is reflected in the current object's metadata.
              doc.sections.length - 1
            )
          : '';
        let physicalRevisionIndex = doc.sections.length - 1 - sectionIndex;
        let physicalSectionIndex = sectionIndex;
        const eventsForObj = doc.history.eventsByObject.get(objNum);
        if (eventsForObj) {
          for (const event of eventsForObj) {
            if (
              event.kind === 'version' &&
              event.sourceKey === entrySourceKey &&
              event.generation === 0
            ) {
              physicalSectionIndex = event.sectionIndex;
              physicalRevisionIndex = event.revisionIndex;
              break;
            }
          }
        }
        storeCurrentObject(doc, {
          objectNumber: item.objectNumber,
          generation: 0,
          value: item.value,
          sectionIndex: physicalSectionIndex,
          revisionIndex: physicalRevisionIndex,
        });
      }
    } catch (e) {
      complete = false;
      if (e instanceof ObjectValueLimitError) {
        addObjectValueLimitDiagnostic(doc, reporter, e);
        break;
      }
      addDiagnostic(doc, reporter, {
        code: 'object-stream-parse',
        message: `Failed to parse object stream ${streamNum}: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
  return complete;
}

// ============================================================================
// Object Stream Parsing (with retained object numbers)
// ============================================================================

export type ParsedObjectStreamItem = {
  objectNumber: number;
  value: PDFObject;
};

/**
 * Parse an object stream, retaining embedded object numbers for validation.
 */
function parseObjectStreamRetainNumbers(
  stream: PDFStream,
  limits?: ParseLimits,
  budget?: ObjectParseBudget
): (ParsedObjectStreamItem | null)[] {
  const dict = stream.dictionary;
  const effectiveLimits = limits ?? DEFAULT_PARSE_LIMITS;
  const effectiveBudget = budget ?? createObjectParseBudget(effectiveLimits.maxObjectValues);

  const nObj = dict.entries.get('N');
  const firstObj = dict.entries.get('First');

  if (nObj?.type !== 'number' || !firstObj || firstObj.type !== 'number') {
    throw new Error('Invalid object stream dictionary');
  }

  const n = nObj.value;
  const first = firstObj.value;

  // Validate N and First are reasonable
  if (!Number.isInteger(n) || n < 0 || n > effectiveLimits.maxObjects) {
    throw new Error(`Invalid /N value in object stream: ${n}`);
  }
  if (!Number.isInteger(first) || first < 0) {
    throw new Error(`Invalid /First value in object stream: ${first}`);
  }

  let data: Uint8Array;
  try {
    data = decodeStream(stream, effectiveLimits);
  } catch (e) {
    throw new Error(
      `Failed to decode object stream: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (first > data.length) {
    throw new Error(`Object stream /First offset ${first} exceeds decoded size ${data.length}`);
  }

  const cursor = createCursor(data, 0);
  const pairs: { objNum: number; offset: number }[] = [];

  // Read object number/offset pairs
  for (let i = 0; i < n; i++) {
    if (cursor.position >= data.length) break;
    const num = readObjectStreamNumber(cursor);
    const off = readObjectStreamNumber(cursor);
    pairs.push({ objNum: num, offset: off });
  }

  // Fixed-length result array: preserves positional indexing for indexInStream lookups.
  // Failed items are null so indexInStream always maps to the correct position.
  const result: (ParsedObjectStreamItem | null)[] = new Array(pairs.length).fill(null);

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!pair) continue;

    const objStart = first + pair.offset;
    if (objStart < 0 || objStart >= data.length) {
      // Offset out of range — leave null
      continue;
    }

    const objCursor = createCursor(data, objStart);
    try {
      const value = parseObject(objCursor, effectiveLimits, 0, effectiveBudget);
      result[i] = {
        objectNumber: pair.objNum,
        value,
      };
    } catch (parseErr) {
      if (parseErr instanceof ObjectValueLimitError) {
        throw parseErr;
      }
      // Parse failure — leave null in this position
    }
  }

  return result;
}

/**
 * Read a whitespace-delimited integer from the object stream header.
 */
function readObjectStreamNumber(cursor: { buffer: Uint8Array; position: number }): number {
  const { buffer } = cursor;
  // Skip whitespace
  while (
    cursor.position < buffer.length &&
    isObjectStreamWhitespace(buffer[cursor.position] ?? 0)
  ) {
    cursor.position++;
  }

  // Read digits
  const start = cursor.position;
  while (cursor.position < buffer.length) {
    const byte = buffer[cursor.position];
    if (byte === undefined || byte < 0x30 || byte > 0x39) break;
    cursor.position++;
  }

  if (cursor.position === start) {
    throw new Error(`Invalid object stream header at position ${start}`);
  }

  let value = 0;
  for (let i = start; i < cursor.position; i++) {
    value = value * 10 + ((buffer[i] ?? 0) - 0x30);
  }
  return value;
}

function isObjectStreamWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x00;
}

// ============================================================================
// Lazy Version Materialization
// ============================================================================

/**
 * Materialize a specific object version on demand.
 * Returns the parsed IndirectObject or throws ObjectVersionParseError.
 */
export function materializeVersion(
  doc: PDFDocument,
  locator: ObjectVersionLocator
): IndirectObject {
  const cacheKey = objectVersionKey(
    locator.objectNumber,
    locator.generation,
    locator.revisionIndex
  );

  // Check cache first
  const cached = doc.history.versionCache.get(cacheKey);
  if (cached) return cached;

  // Cycle detection (P1-2)
  if (doc.history.materializingKeys.has(cacheKey)) {
    throw new Error(
      `Cyclic materialization detected for object ${locator.objectNumber} ` +
        `generation ${locator.generation} at revision ${locator.revisionIndex}`
    );
  }
  doc.history.materializingKeys.add(cacheKey);

  try {
    let result: IndirectObject;

    if (locator.entry.type === 'used') {
      result = materializeUncompressed(doc, locator);
    } else if (locator.entry.type === 'compressed') {
      const compressed = materializeCompressed(doc, locator);
      if (!compressed) {
        throw new Error(
          `Compressed object ${locator.objectNumber} could not be resolved: ` +
            `object stream ${locator.entry.objectStreamNumber} not found or not parseable ` +
            `at revision ${locator.revisionIndex}`
        );
      }
      result = compressed;
    } else {
      throw new Error(`Unknown entry type for object ${locator.objectNumber}`);
    }

    doc.history.versionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof ObjectValueLimitError) {
      doc.complete = false;
      doc.history.complete = false;
      const message = `Maximum PDF object values (${error.limit}) reached during lazy history materialization.`;
      doc.history.incompleteReason ??= message;
      if (
        !doc.diagnostics.some(
          diagnostic => diagnostic.code === 'max-object-values' && diagnostic.message === message
        )
      ) {
        doc.diagnostics.push({ code: 'max-object-values', message });
      }
    }
    throw error;
  } finally {
    doc.history.materializingKeys.delete(cacheKey);
  }
}

/**
 * Materialize an uncompressed (used) object version from its byte offset.
 * Throws on parse failure (never returns null).
 */
function materializeUncompressed(doc: PDFDocument, locator: ObjectVersionLocator): IndirectObject {
  const entry = locator.entry as { type: 'used'; offset: number; generation: number };

  if (entry.offset < 0 || entry.offset >= doc.buffer.length) {
    throw new Error(
      `XRef offset ${entry.offset} out of bounds (buffer size ${doc.buffer.length}) ` +
        `for object ${locator.objectNumber} at revision ${locator.revisionIndex}`
    );
  }

  const indirectObj =
    findPreparsedXRefStreamObject(doc, entry.offset) ??
    parseIndirectObject(
      createCursor(doc.buffer, entry.offset),
      doc.history.limits,
      getObjectValueBudget(doc, doc.history.limits)
    );

  // Verify object number and generation match the locator.
  // Mismatch is a data-integrity defect — fail materialization.
  if (
    indirectObj.objectNumber !== locator.objectNumber ||
    indirectObj.generation !== locator.generation
  ) {
    throw new Error(
      `Object at offset ${entry.offset} has unexpected identity: ` +
        `expected ${locator.objectNumber} ${locator.generation}, ` +
        `got ${indirectObj.objectNumber} ${indirectObj.generation}`
    );
  }

  return {
    objectNumber: indirectObj.objectNumber,
    generation: indirectObj.generation,
    value: indirectObj.value,
    sectionIndex: locator.sectionIndex,
    revisionIndex: locator.revisionIndex,
  };
}

/**
 * Materialize a compressed object version by parsing the appropriate
 * object-stream version.
 */
function materializeCompressed(doc: PDFDocument, locator: ObjectVersionLocator): IndirectObject {
  const entry = locator.entry as XRefEntryCompressed;

  // Get the object stream version effective at this revision
  const streamObj = getObjectAtRevision(doc, entry.objectStreamNumber, 0, locator.revisionIndex);

  if (streamObj?.value.type !== 'stream') {
    throw new Error(
      `Object stream ${entry.objectStreamNumber} not found at revision ${locator.revisionIndex}`
    );
  }

  const typeEntry = streamObj.value.dictionary.entries.get('Type');
  if (typeEntry?.type !== 'name' || typeEntry.value !== 'ObjStm') {
    throw new Error(
      `Stream ${entry.objectStreamNumber} is not an Object Stream at revision ${locator.revisionIndex}`
    );
  }

  // Check parsed stream cache (P1-3)
  const streamVersionKey = objectVersionKey(
    entry.objectStreamNumber,
    0,
    streamObj.revisionIndex ?? locator.revisionIndex
  );
  let parsedItems = doc.history.parsedStreamCache.get(streamVersionKey) ?? null;

  if (!parsedItems) {
    try {
      parsedItems = parseObjectStreamRetainNumbers(
        streamObj.value,
        doc.history.limits,
        getObjectValueBudget(doc, doc.history.limits)
      );
      doc.history.parsedStreamCache.set(streamVersionKey, parsedItems);
    } catch (e) {
      if (e instanceof ObjectValueLimitError) {
        throw e;
      }
      throw new Error(
        `Failed to parse object stream ${entry.objectStreamNumber} ` +
          `at revision ${locator.revisionIndex}:`,
        { cause: e }
      );
    }
  }

  if (entry.indexInStream < 0 || entry.indexInStream >= parsedItems.length) {
    throw new Error(
      `Index ${entry.indexInStream} out of range for object stream ${entry.objectStreamNumber} ` +
        `at revision ${locator.revisionIndex} (${parsedItems.length} items)`
    );
  }

  const item = parsedItems[entry.indexInStream];
  if (!item) {
    throw new Error(
      `Object stream ${entry.objectStreamNumber} item ${entry.indexInStream} could not be parsed`
    );
  }

  // Validate embedded object number matches — fatal on mismatch
  if (item.objectNumber !== locator.objectNumber) {
    throw new Error(
      `Object stream mismatch: expected ${locator.objectNumber} at index ${entry.indexInStream}, ` +
        `got ${item.objectNumber}. Skipping.`
    );
  }

  return {
    objectNumber: locator.objectNumber,
    generation: 0,
    value: item.value,
    sectionIndex: locator.sectionIndex,
    revisionIndex: locator.revisionIndex,
  };
}
// We import it below to avoid circular dependency at the top of this module.

// ============================================================================
// getObjectAtRevision (core, used internally by materializeCompressed)
// ============================================================================

/**
 * Get the object effective at a given chronological revision.
 *
 * Replays history events up to and including the target revision.
 * Returns null if the requested identity is not active at that revision.
 */
export function getObjectAtRevision(
  doc: PDFDocument,
  objectNumber: number,
  generation: number,
  revisionIndex: number
): IndirectObject | null {
  // Validate revision range
  const newestRevision = doc.sections.length - 1;
  if (revisionIndex < 0 || revisionIndex > newestRevision) {
    return null;
  }

  // Fast path for newest revision: use doc.objects directly
  if (revisionIndex >= newestRevision) {
    const key = objectKey(objectNumber, generation);
    return doc.objects.get(key) ?? null;
  }

  const events = doc.history.eventsByObject.get(objectNumber);
  if (!events || events.length === 0) {
    return null;
  }

  // Replay events up to revisionIndex
  let activeVersionLocator: ObjectVersionLocator | null = null;
  let activeGeneration = -1;

  for (const event of events) {
    if (event.revisionIndex > revisionIndex) break;

    if (event.kind === 'free') {
      // Free event clears all generations for this object number
      activeVersionLocator = null;
      activeGeneration = -1;
    } else if (event.kind === 'version') {
      // Version event makes this identity active
      activeVersionLocator = event;
      activeGeneration = event.generation;
    }
  }

  // Check if the active identity matches the requested generation
  if (!activeVersionLocator || activeGeneration !== generation) {
    return null;
  }

  // Materialize from the locator
  try {
    return materializeVersion(doc, activeVersionLocator);
  } catch (e) {
    doc.diagnostics.push({
      code: 'history-materialization',
      message:
        `Failed to materialize object ${objectNumber} ${generation} ` +
        `at revision ${revisionIndex}: ${e instanceof Error ? e.message : String(e)}`,
    });
    return null;
  }
}
