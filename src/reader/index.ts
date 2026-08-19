/**
 * PDF Reader Module
 * High-performance PDF parser optimized for V8
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Buffer types
  Cursor,
  // Document types
  IndirectObject,
  // History types
  ObjectFreeEvent,
  ObjectHistoryEvent,
  ObjectHistoryIndex,
  ObjectLifecycle,
  ObjectParseBudget,
  ObjectParseOptions,
  ObjectVersionDescriptor,
  ObjectVersionLocator,
  ParseDiagnostic,
  // Result types
  ParseError,
  ParseLimits,
  ParseOptions,
  ParseResult,
  PDFArray,
  PDFBoolean,
  PDFDictionary,
  PDFDocument,
  PDFHexString,
  PDFName,
  // PDF Object types
  PDFNull,
  PDFNumber,
  PDFObject,
  PDFReference,
  PDFStream,
  PDFString,
  RevisionMetadata,
  Token,
  // Token types
  TokenType,
  XRefEntry,
  XRefEntryCompressed,
  // XRef types
  XRefEntryFree,
  XRefEntryUsed,
  XRefSection,
} from './types.js';

// ============================================================================
// Type helpers and guards
// ============================================================================

export {
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
  isArray,
  isBoolean,
  isDictionary,
  isHexString,
  isName,
  isNull,
  isNumber,
  isReference,
  isStream,
  isString,
  MAX_PDF_GENERATION,
  ObjectVersionParseError,
  objectKey,
  objectVersionKey,
} from './types.js';

// ============================================================================
// Main API
// ============================================================================

export { getCatalog, getInfo, getObject, getTrailer, parse, resolveReference } from './parser.js';

// ============================================================================
// Document Navigation
// ============================================================================

export {
  decodePDFNameValue,
  decodePDFString,
  getAuthor,
  getCreator,
  getDictArray,
  getDictDict,
  getDictEntry,
  getDictNumber,
  getDictString,
  getKeywords,
  getObjectSection,
  getPage,
  getPageCount,
  getPages,
  getPagesRoot,
  getProducer,
  getSectionCount,
  getSections,
  getSubject,
  getTitle,
} from './document.js';

// ============================================================================
// History & Revision API
// ============================================================================

export {
  extractRevisionMetadata,
  getAllObjectLifecycles,
  getObjectAtRevision,
  getObjectHistory,
  getObjectLifecycle,
  getObjectsInSection,
  getObjectVersion,
  getObjectVersionCount,
  getObjectVersionDescriptors,
  getRevisionMetadata,
  resolveReferenceAtRevision,
} from './history-api.js';

// ============================================================================
// Low-level API (for advanced usage)
// ============================================================================

export { bytesToString, createCursor } from './buffer.js';
export { ObjectValueLimitError, parseIndirectObject, parseObject } from './objects.js';
export { nextToken, peekToken } from './tokenizer.js';
export {
  inflate,
  isXRefStream,
  isXRefTable,
  parseXRefStream,
  parseXRefTable,
} from './xref/index.js';

// ============================================================================
// Semantic Diff
// ============================================================================

export type {
  ArrayDiff,
  ArrayDiffEntry,
  DictDiffEntry,
  DictionaryDiff,
  StreamDiff,
} from './diff.js';
export {
  diffArrays,
  diffDictionaries,
  diffStreams,
  equalPDFObject,
} from './diff.js';
export { decodeStream } from './stream.js';
