/**
 * Semantic PDF Object Diff
 *
 * Compares PDF objects structurally — no JSON.stringify().
 * Handles: primitives, strings (raw bytes), references, arrays,
 * dictionaries, and streams.
 */

import { decodeStream } from './stream.js';
import type { PDFArray, PDFDictionary, PDFObject, PDFStream } from './types.js';
import { DEFAULT_PARSE_LIMITS } from './types.js';

// ============================================================================
// Types
// ============================================================================

export type DictDiffEntry = {
  key: string;
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: PDFObject | undefined;
  newValue?: PDFObject | undefined;
};

export type DictionaryDiff = {
  entries: DictDiffEntry[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
};

export type ArrayDiffEntry = {
  index: number;
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: PDFObject | undefined;
  newValue?: PDFObject | undefined;
};

export type ArrayDiff = {
  entries: ArrayDiffEntry[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
};

export type StreamDiff = {
  /** Whether the stream dictionaries differ */
  dictChanged: boolean;
  /** Per-key dictionary diff */
  dictDiff: DictionaryDiff;
  /** Whether raw data bytes differ */
  rawDataChanged: boolean;
  /** Old raw data length */
  oldRawLength: number;
  /** New raw data length */
  newRawLength: number;
  /** First N bytes of old raw data (hex) */
  oldRawPreview?: string;
  /** First N bytes of new raw data (hex) */
  newRawPreview?: string;
  /** SHA-256-like short hash of old raw data */
  oldHash?: string;
  /** SHA-256-like short hash of new raw data */
  newHash?: string;
  /** Whether decoded data comparison was attempted */
  decodedCompared: boolean;
  /** Whether decoded data differs (only if decodedCompared = true) */
  decodedChanged?: boolean;
};

// ============================================================================
// Equality Comparator
// ============================================================================

/** Maximum recursion depth for equality comparison */
const MAX_EQ_DEPTH = DEFAULT_PARSE_LIMITS.maxDepth;
type ComparedPairs = WeakMap<object, WeakSet<object>>;

/**
 * Compare two PDF objects for semantic equality.
 * Does NOT use JSON.stringify() — handles Maps, raw bytes, etc. explicitly.
 */
export function equalPDFObject(
  a: PDFObject | undefined | null,
  b: PDFObject | undefined | null,
  depth: number = 0
): boolean {
  return equalPDFObjectInternal(a, b, depth, new WeakMap());
}

function equalPDFObjectInternal(
  a: PDFObject | undefined | null,
  b: PDFObject | undefined | null,
  depth: number,
  comparedPairs: ComparedPairs
): boolean {
  // Both null/undefined → equal
  if (a == null && b == null) return true;
  // One null/undefined → not equal
  if (a == null || b == null) return false;
  // Identity is always reflexive, including objects deeper than the safety
  // limit. This also prevents cyclic self-references from recursing forever.
  if (a === b) return true;
  // Different types → not equal
  if (a.type !== b.type) return false;
  const pairsForA = comparedPairs.get(a);
  if (pairsForA?.has(b)) return true;
  // Depth guard — conservative: return false when limit exceeded.
  // Returning true could hide real differences below the limit.
  if (depth > MAX_EQ_DEPTH) return false;
  if (pairsForA) pairsForA.add(b);
  else comparedPairs.set(a, new WeakSet([b]));

  switch (a.type) {
    case 'null':
      return true;

    case 'boolean':
      return a.value === (b as typeof a).value;

    case 'number':
      return a.value === (b as typeof a).value;

    case 'string':
    case 'hexstring':
      return rawBytesEqual(a.raw, (b as typeof a).raw);

    case 'name':
      return a.value === (b as typeof a).value;

    case 'reference':
      return (
        a.objectNumber === (b as typeof a).objectNumber &&
        a.generation === (b as typeof a).generation
      );

    case 'array': {
      const arrA = a as PDFArray;
      const arrB = b as PDFArray;
      if (arrA.items.length !== arrB.items.length) return false;
      for (let i = 0; i < arrA.items.length; i++) {
        if (!equalPDFObjectInternal(arrA.items[i], arrB.items[i], depth + 1, comparedPairs)) {
          return false;
        }
      }
      return true;
    }

    case 'dictionary': {
      const dictA = a as PDFDictionary;
      const dictB = b as PDFDictionary;
      if (dictA.entries.size !== dictB.entries.size) return false;
      for (const [key, valA] of dictA.entries) {
        const valB = dictB.entries.get(key);
        if (!equalPDFObjectInternal(valA, valB, depth + 1, comparedPairs)) return false;
      }
      return true;
    }

    case 'stream': {
      const sA = a as PDFStream;
      const sB = b as PDFStream;
      // Compare dictionaries
      if (!equalPDFObjectInternal(sA.dictionary, sB.dictionary, depth + 1, comparedPairs)) {
        return false;
      }
      // Compare raw data
      if (!rawBytesEqual(sA.data, sB.data)) return false;
      return true;
    }

    default:
      return false;
  }
}

function rawBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================================================
// Dictionary Diff
// ============================================================================

/**
 * Compute a direct-child diff between two dictionaries.
 * Only compares immediate key-value pairs, not recursively.
 */
export function diffDictionaries(
  oldDict: PDFDictionary | undefined | null,
  newDict: PDFDictionary | undefined | null
): DictionaryDiff {
  const entries: DictDiffEntry[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  const oldEntries = oldDict?.entries ?? new Map();
  const newEntries = newDict?.entries ?? new Map();

  // Collect all keys
  const allKeys = new Set([...oldEntries.keys(), ...newEntries.keys()]);

  for (const key of allKeys) {
    const oldVal = oldEntries.get(key);
    const newVal = newEntries.get(key);

    if (oldVal === undefined && newVal !== undefined) {
      entries.push({ key, kind: 'added', newValue: newVal });
      addedCount++;
    } else if (oldVal !== undefined && newVal === undefined) {
      entries.push({ key, kind: 'removed', oldValue: oldVal });
      removedCount++;
    } else if (!equalPDFObject(oldVal, newVal)) {
      entries.push({ key, kind: 'changed', oldValue: oldVal, newValue: newVal });
      changedCount++;
    } else {
      entries.push({ key, kind: 'unchanged' });
      unchangedCount++;
    }
  }

  // Sort: changed/added/removed first, then unchanged
  entries.sort((a, b) => {
    const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    return (order[a.kind] ?? 4) - (order[b.kind] ?? 4);
  });

  return { entries, addedCount, removedCount, changedCount, unchangedCount };
}

// ============================================================================
// Array Diff
// ============================================================================

/**
 * Compute an item-by-item diff between two PDF arrays.
 * Items at the same index are compared; extra items are added/removed.
 */
export function diffArrays(
  oldArr: PDFArray | undefined | null,
  newArr: PDFArray | undefined | null
): ArrayDiff {
  const entries: ArrayDiffEntry[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  const oldItems = oldArr?.items ?? [];
  const newItems = newArr?.items ?? [];
  const maxLen = Math.max(oldItems.length, newItems.length);

  for (let i = 0; i < maxLen; i++) {
    const oldVal = oldItems[i];
    const newVal = newItems[i];

    if (oldVal === undefined && newVal !== undefined) {
      entries.push({ index: i, kind: 'added', newValue: newVal });
      addedCount++;
    } else if (oldVal !== undefined && newVal === undefined) {
      entries.push({ index: i, kind: 'removed', oldValue: oldVal });
      removedCount++;
    } else if (!equalPDFObject(oldVal, newVal)) {
      const entry: ArrayDiffEntry = { index: i, kind: 'changed' };
      if (oldVal !== undefined) entry.oldValue = oldVal;
      if (newVal !== undefined) entry.newValue = newVal;
      entries.push(entry);
      changedCount++;
    } else {
      entries.push({ index: i, kind: 'unchanged' });
      unchangedCount++;
    }
  }

  // Sort: changed/added/removed first, then unchanged
  entries.sort((a, b) => {
    const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    return (order[a.kind] ?? 4) - (order[b.kind] ?? 4);
  });

  return { entries, addedCount, removedCount, changedCount, unchangedCount };
}

// ============================================================================
// Stream Diff
// ============================================================================

const STREAM_PREVIEW_BYTES = 64;

/**
 * Compare two streams — dictionaries and raw data.
 * Optionally compares decoded data if both streams use the same filter.
 */
export function diffStreams(
  oldStream: PDFStream | undefined | null,
  newStream: PDFStream | undefined | null
): StreamDiff {
  if (!oldStream && !newStream) {
    return {
      dictChanged: false,
      dictDiff: { entries: [], addedCount: 0, removedCount: 0, changedCount: 0, unchangedCount: 0 },
      rawDataChanged: false,
      oldRawLength: 0,
      newRawLength: 0,
      decodedCompared: false,
    };
  }

  if (!oldStream || !newStream) {
    return {
      dictChanged: true,
      dictDiff: { entries: [], addedCount: 0, removedCount: 0, changedCount: 0, unchangedCount: 0 },
      rawDataChanged: true,
      oldRawLength: oldStream?.data.length ?? 0,
      newRawLength: newStream?.data.length ?? 0,
      decodedCompared: false,
    };
  }

  // Dictionary diff
  const dictDiff = diffDictionaries(oldStream.dictionary, newStream.dictionary);
  const dictChanged =
    dictDiff.changedCount > 0 || dictDiff.addedCount > 0 || dictDiff.removedCount > 0;

  // Raw data comparison
  const oldData = oldStream.data;
  const newData = newStream.data;
  const rawDataChanged = !rawBytesEqual(oldData, newData);

  const result: StreamDiff = {
    dictChanged,
    dictDiff,
    rawDataChanged,
    oldRawLength: oldData.length,
    newRawLength: newData.length,
    oldRawPreview: formatHexPreview(oldData, STREAM_PREVIEW_BYTES),
    newRawPreview: formatHexPreview(newData, STREAM_PREVIEW_BYTES),
    oldHash: simpleHash(oldData),
    newHash: simpleHash(newData),
    decodedCompared: false,
  };

  // Optionally compare decoded data (only if same filter)
  const oldFilter = oldStream.dictionary.entries.get('Filter');
  const newFilter = newStream.dictionary.entries.get('Filter');

  if (oldFilter && newFilter && equalPDFObject(oldFilter, newFilter)) {
    try {
      const oldDecoded = decodeStream(oldStream, DEFAULT_PARSE_LIMITS);
      const newDecoded = decodeStream(newStream, DEFAULT_PARSE_LIMITS);
      result.decodedCompared = true;
      result.decodedChanged = !rawBytesEqual(oldDecoded, newDecoded);
    } catch {
      // Keep decodedCompared=false when a filter is unsupported or malformed.
    }
  } else if (!oldFilter && !newFilter) {
    result.decodedCompared = true;
    result.decodedChanged = rawDataChanged;
  }

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHexPreview(data: Uint8Array, maxBytes: number): string {
  if (!data || data.length === 0) return '';
  const len = Math.min(data.length, maxBytes);
  const hex: string[] = [];
  for (let i = 0; i < len; i++) {
    hex.push((data[i] ?? 0).toString(16).padStart(2, '0'));
  }
  return hex.join(' ');
}

/**
 * Simple non-cryptographic hash for quick data comparison.
 * Returns first 8 hex chars of a djb2-like hash.
 */
function simpleHash(data: Uint8Array): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + (data[i] ?? 0)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
