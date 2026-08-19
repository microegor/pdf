/**
 * PDF Reader Types
 * All types are defined as simple objects to minimize prototype overhead
 */

// ============================================================================
// Buffer Types
// ============================================================================

/**
 * Cursor for reading through the buffer
 */
export type Cursor = {
  buffer: Uint8Array;
  position: number;
};

// ============================================================================
// PDF Object Types
// ============================================================================

export type PDFNull = {
  type: 'null';
};

export type PDFBoolean = {
  type: 'boolean';
  value: boolean;
};

export type PDFNumber = {
  type: 'number';
  value: number;
};

/**
 * PDF String - stores raw bytes without conversion
 * The raw field is a subarray view of the original buffer
 */
export type PDFString = {
  type: 'string';
  raw: Uint8Array;
};

/**
 * PDF Hex String - stores raw hex bytes
 */
export type PDFHexString = {
  type: 'hexstring';
  raw: Uint8Array;
};

/**
 * PDF Name - stored as string since names are typically short
 */
export type PDFName = {
  type: 'name';
  value: string;
};

/**
 * PDF Array
 */
export type PDFArray = {
  type: 'array';
  items: PDFObject[];
};

/**
 * PDF Dictionary - uses Map for O(1) lookups
 */
export type PDFDictionary = {
  type: 'dictionary';
  entries: Map<string, PDFObject>;
};

/**
 * PDF Stream - dictionary with associated data
 * Data is a subarray view of the original buffer
 */
export type PDFStream = {
  type: 'stream';
  dictionary: PDFDictionary;
  data: Uint8Array;
};

/**
 * PDF Reference to indirect object
 */
export type PDFReference = {
  type: 'reference';
  objectNumber: number;
  generation: number;
};

/**
 * Union of all PDF object types
 */
export type PDFObject =
  | PDFNull
  | PDFBoolean
  | PDFNumber
  | PDFString
  | PDFHexString
  | PDFName
  | PDFArray
  | PDFDictionary
  | PDFStream
  | PDFReference;

/** Largest generation number allowed by PDF indirect-object and XRef identities. */
export const MAX_PDF_GENERATION = 65_535;

// ============================================================================
// XRef Types
// ============================================================================

/**
 * Free object entry in XRef
 */
export type XRefEntryFree = {
  type: 'free';
  nextFreeObject: number;
  generation: number;
};

/**
 * Used object entry in XRef - object is at specified byte offset
 */
export type XRefEntryUsed = {
  type: 'used';
  offset: number;
  generation: number;
};

/**
 * Compressed object entry - object is in an object stream
 */
export type XRefEntryCompressed = {
  type: 'compressed';
  objectStreamNumber: number;
  indexInStream: number;
};

/**
 * Union of XRef entry types
 */
export type XRefEntry = XRefEntryFree | XRefEntryUsed | XRefEntryCompressed;

/**
 * XRef Section representing one update section of the document
 * Documents with incremental updates have multiple sections
 */
export type XRefSection = {
  /** objectNumber -> entry */
  entries: Map<number, XRefEntry>;
  trailer: PDFDictionary;
  /** Position of startxref */
  startXRef: number;
  /** Reference to previous XRef section */
  prev?: number;
  /** The trailer contains a malformed /Prev value; parsing stopped at this section. */
  malformedPrev?: boolean;
  /** Chronological revision index, oldest = 0. Set after parsing. */
  revisionIndex?: number;
  /** Diagnostic: offset of the supplemental /XRefStm, if any */
  hybridXRefStreamOffset?: number;
  /**
   * XRef-stream object parsed while reading this logical section.
   * Retained so object materialization can reuse the value without charging
   * the document-wide object-value budget a second time.
   */
  xrefStreamObject?: {
    offset: number;
    objectNumber: number;
    generation: number;
    value: PDFStream;
  };
  /** Best-effort revision metadata (extracted after history indexing) */
  metadata?: RevisionMetadata;
};

/**
 * Revision metadata extracted from trailer /Info
 */
export type RevisionMetadata = {
  modifiedDate?: {
    /** Raw decoded PDF date string */
    raw: string;
    /** ISO 8601 string if parseable, undefined otherwise */
    iso?: string | undefined;
  };
  producer?: string | undefined;
  fileId?:
    | {
        permanent: string;
        revision: string;
      }
    | undefined;
};

// ============================================================================
// History Types
// ============================================================================

/**
 * Locator for a specific written version of an indirect object.
 * Identifies the exact byte location and revision where this version was written.
 */
export type ObjectVersionLocator = {
  kind: 'version';
  objectNumber: number;
  generation: number;
  sectionIndex: number;
  revisionIndex: number;
  entry: XRefEntryUsed | XRefEntryCompressed;
  /** Stable identity of the physical object version */
  sourceKey: string;
};

/**
 * Records that an object number was freed in a specific revision.
 */
export type ObjectFreeEvent = {
  kind: 'free';
  objectNumber: number;
  /** The generation that the free entry declares as "next" */
  nextGeneration: number;
  sectionIndex: number;
  revisionIndex: number;
};

/**
 * A history event — either a written version or a free event.
 * Events are ordered oldest → newest per object number.
 */
export type ObjectHistoryEvent = ObjectVersionLocator | ObjectFreeEvent;

/**
 * Parsed item from an object stream, retaining embedded object number.
 */
export type ParsedObjectStreamItem = {
  objectNumber: number;
  value: PDFObject;
};

/**
 * Cumulative budget shared by every object-value parser in one document.
 *
 * The low-level parser creates a fresh budget for standalone calls, while the
 * document parser keeps one instance in its history index so current-state,
 * object-stream and lazy-history parsing all draw from the same limit.
 */
export type ObjectParseBudget = {
  limit: number;
  used: number;
};

/**
 * Index of all object history events, built during parsing.
 */
export type ObjectHistoryIndex = {
  /** History events keyed by object number */
  eventsByObject: Map<number, readonly ObjectHistoryEvent[]>;
  /** Cache of parsed historical object versions */
  versionCache: Map<string, IndirectObject>;
  /** Whether the history index is complete (not truncated by limits) */
  complete: boolean;
  /** Explanation when history completeness is false. */
  incompleteReason?: string;
  /** Parse limits for lazy materialization */
  limits: ParseLimits;
  /** Shared cumulative direct-value budget for eager and lazy parsing. */
  objectValueBudget?: ObjectParseBudget;
  /** In-progress keys for cycle detection during materialization */
  materializingKeys: Set<string>;
  /** Parsed object-stream content cache, keyed by stream version key */
  parsedStreamCache: Map<string, readonly (ParsedObjectStreamItem | null)[]>;
};

/**
 * Lightweight descriptor for a written object version.
 * Used by public APIs to enumerate versions without materializing them.
 */
export type ObjectVersionDescriptor = {
  objectNumber: number;
  generation: number;
  /** Index into the written-version list (oldest = 0) */
  versionIndex: number;
  /** Internal history-event index used for O(1) materialization. */
  eventIndex: number;
  sectionIndex: number;
  revisionIndex: number;
};

/**
 * Lifecycle summary for an object identity.
 */
export type ObjectLifecycle = {
  objectNumber: number;
  generation: number;
  /** Number of written versions (excluding free events) */
  versionCount: number;
  /** Whether this identity has an active object in doc.objects */
  isCurrent: boolean;
  /** Revision in which this identity was first written */
  createdInRevision: number;
  /** Revision in which this identity was last written */
  lastWrittenInRevision: number;
  /** Revision in which this identity was freed, if applicable */
  freedInRevision?: number | undefined;
  /** Whether the history is complete (not truncated) */
  historyComplete: boolean;
};

/**
 * Error thrown when a historical object version fails to parse.
 */
export class ObjectVersionParseError extends Error {
  descriptor: ObjectVersionDescriptor;
  override cause: unknown;

  constructor(descriptor: ObjectVersionDescriptor, cause: unknown) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? 'unknown error');
    const msg =
      `Failed to parse object ${descriptor.objectNumber} ${descriptor.generation} ` +
      `version ${descriptor.versionIndex} (revision ${descriptor.revisionIndex}): ${causeMsg}`;
    super(msg);
    this.name = 'ObjectVersionParseError';
    this.descriptor = descriptor;
    this.cause = cause;
  }
}

// ============================================================================
// Document Types
// ============================================================================

/**
 * Parsed indirect object with metadata
 */
export type IndirectObject = {
  objectNumber: number;
  generation: number;
  value: PDFObject;
  sectionIndex: number; // Which section this object belongs to (newest = 0)
  revisionIndex?: number; // Chronological revision index, oldest = 0
};

/**
 * PDF Document structure
 */
export type PDFDocument = {
  /** Private snapshot of the input bytes, stable for lazy materialization. */
  buffer: Uint8Array;
  version: string; // PDF version (e.g., "1.7", "2.0")
  sections: XRefSection[]; // Update sections (newest first)
  objects: Map<string, IndirectObject>; // Cache of parsed objects (newest active only)
  history: ObjectHistoryIndex; // Object history index
  /** False when a configured limit caused a partial parse. */
  complete: boolean;
  /** Non-fatal issues reported while parsing. */
  diagnostics: ParseDiagnostic[];
};

// ============================================================================
// Token Types
// ============================================================================

export type TokenType =
  | 'keyword' // true, false, null, obj, endobj, stream, endstream, xref, trailer, startxref, R
  | 'number' // Integer or real numbers
  | 'name' // /Name
  | 'string' // (literal string)
  | 'hexstring' // <hex string>
  | 'array_start' // [
  | 'array_end' // ]
  | 'dict_start' // <<
  | 'dict_end' // >>
  | 'eof'; // End of file

export type Token = {
  type: TokenType;
  start: number; // Position in buffer
  end: number; // End position
  value?: string | number; // Parsed value for keywords, names, numbers
};

// ============================================================================
// Result Types
// ============================================================================

export type ParseError = {
  code: string;
  message: string;
  position: number;
  context?: string;
};

export type ParseResult<T> = { success: true; value: T } | { success: false; error: ParseError };

/** A non-fatal parser diagnostic collected for callers that use recovery mode. */
export type ParseDiagnostic = {
  code: string;
  message: string;
  position?: number;
};

// ============================================================================
// Parse Options
// ============================================================================

/**
 * Limits to protect against malicious or malformed PDFs.
 * Set to Infinity to disable a particular limit.
 */
export type ParseLimits = {
  /** Maximum file size in bytes (default: 100 MB) */
  maxFileBytes: number;
  /** Maximum number of indirect objects (default: 500,000) */
  maxObjects: number;
  /** Maximum total XRef entries retained across all revisions (default: 1,000,000) */
  maxXRefEntries: number;
  /** Maximum number of XRef sections / incremental updates (default: 1,000) */
  maxSections: number;
  /** Maximum nesting depth for arrays and dictionaries (default: 100) */
  maxDepth: number;
  /** Maximum number of direct values parsed across the document (default: 500,000) */
  maxObjectValues: number;
  /** Maximum raw size of one literal, hex string or name (default: 10 MB) */
  maxStringBytes: number;
  /** Maximum size of a single stream in bytes (default: 100 MB) */
  maxStreamBytes: number;
  /** Maximum decoded (decompressed) size of a stream (default: 200 MB) */
  maxDecodedStreamBytes: number;
  /** Maximum number of object history versions indexed (default: 500,000) */
  maxObjectVersions: number;
};

export const DEFAULT_PARSE_LIMITS: ParseLimits = {
  maxFileBytes: 100 * 1024 * 1024,
  maxObjects: 500_000,
  maxXRefEntries: 1_000_000,
  maxSections: 1_000,
  maxDepth: 100,
  maxObjectValues: 500_000,
  maxStringBytes: 10 * 1024 * 1024,
  maxStreamBytes: 100 * 1024 * 1024,
  maxDecodedStreamBytes: 200 * 1024 * 1024,
  maxObjectVersions: 500_000,
};

/**
 * Options for parsing a PDF document.
 */
export type ParseOptions = {
  limits?: Partial<ParseLimits>;
  /** Called for non-fatal parser diagnostics. */
  onDiagnostic?: (diagnostic: ParseDiagnostic) => void;
};

/** Limits accepted by the low-level object parser. */
export type ObjectParseOptions = Pick<
  ParseLimits,
  'maxDepth' | 'maxObjectValues' | 'maxStringBytes' | 'maxStreamBytes'
>;

/** Create a fresh cumulative object-value budget. */
export function createObjectParseBudget(limit: number): ObjectParseBudget {
  return { limit, used: 0 };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a unique key for an object reference
 */
export function objectKey(objectNumber: number, generation: number): string {
  return `${objectNumber}_${generation}`;
}

/**
 * Create a unique cache key for an object version.
 * Includes revisionIndex because the same (objectNumber, generation) can
 * be written multiple times across revisions.
 */
export function objectVersionKey(
  objectNumber: number,
  generation: number,
  revisionIndex: number
): string {
  return `${objectNumber}_${generation}@${revisionIndex}`;
}

/**
 * Create PDF null object
 */
export function createNull(): PDFNull {
  return { type: 'null' };
}

/**
 * Create PDF boolean object
 */
export function createBoolean(value: boolean): PDFBoolean {
  return { type: 'boolean', value };
}

/**
 * Create PDF number object
 */
export function createNumber(value: number): PDFNumber {
  return { type: 'number', value };
}

/**
 * Create PDF string object
 */
export function createString(raw: Uint8Array): PDFString {
  return { type: 'string', raw };
}

/**
 * Create PDF hex string object
 */
export function createHexString(raw: Uint8Array): PDFHexString {
  return { type: 'hexstring', raw };
}

/**
 * Create PDF name object
 */
export function createName(value: string): PDFName {
  return { type: 'name', value };
}

/**
 * Create PDF array object
 */
export function createArray(items: PDFObject[]): PDFArray {
  return { type: 'array', items };
}

/**
 * Create PDF dictionary object
 */
export function createDictionary(entries?: Map<string, PDFObject>): PDFDictionary {
  return { type: 'dictionary', entries: entries ?? new Map() };
}

/**
 * Create PDF stream object
 */
export function createStream(dictionary: PDFDictionary, data: Uint8Array): PDFStream {
  return { type: 'stream', dictionary, data };
}

/**
 * Create PDF reference object
 */
export function createReference(objectNumber: number, generation: number): PDFReference {
  return { type: 'reference', objectNumber, generation };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isNull(obj: PDFObject): obj is PDFNull {
  return obj.type === 'null';
}

export function isBoolean(obj: PDFObject): obj is PDFBoolean {
  return obj.type === 'boolean';
}

export function isNumber(obj: PDFObject): obj is PDFNumber {
  return obj.type === 'number';
}

export function isString(obj: PDFObject): obj is PDFString {
  return obj.type === 'string';
}

export function isHexString(obj: PDFObject): obj is PDFHexString {
  return obj.type === 'hexstring';
}

export function isName(obj: PDFObject): obj is PDFName {
  return obj.type === 'name';
}

export function isArray(obj: PDFObject): obj is PDFArray {
  return obj.type === 'array';
}

export function isDictionary(obj: PDFObject): obj is PDFDictionary {
  return obj.type === 'dictionary';
}

export function isStream(obj: PDFObject): obj is PDFStream {
  return obj.type === 'stream';
}

export function isReference(obj: PDFObject): obj is PDFReference {
  return obj.type === 'reference';
}
