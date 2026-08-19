/**
 * PDF Document Navigation
 * Functions for navigating document structure and sections
 */

import { decodePDFNameValue, decodePDFString } from './encoding.js';
import { getObjectsInSection as getObjectsInSectionHistory } from './history-api.js';
import { getCatalog, resolveReference } from './parser.js';
import type {
  IndirectObject,
  PDFArray,
  PDFDictionary,
  PDFDocument,
  PDFObject,
  XRefSection,
} from './types.js';
import { isArray, isDictionary, objectKey } from './types.js';

export { decodePDFNameValue, decodePDFString } from './encoding.js';

// ============================================================================
// Section Navigation
// ============================================================================

/**
 * Get all XRef sections (incremental updates)
 */
export function getSections(doc: PDFDocument): XRefSection[] {
  return doc.sections;
}

/**
 * Get number of sections (incremental updates)
 */
export function getSectionCount(doc: PDFDocument): number {
  return doc.sections.length;
}

/**
 * Get objects that belong to a specific section.
 * Now includes historical versions written in that section, not only
 * currently active objects.
 */
export function getObjectsInSection(doc: PDFDocument, sectionIndex: number): IndirectObject[] {
  return getObjectsInSectionHistory(doc, sectionIndex);
}

/**
 * Get section index where an object was last modified
 */
export function getObjectSection(
  doc: PDFDocument,
  objectNumber: number,
  generation: number = 0
): number {
  const key = objectKey(objectNumber, generation);
  const obj = doc.objects.get(key);
  return obj?.sectionIndex ?? -1;
}

// ============================================================================
// Document Structure Navigation
// ============================================================================

/**
 * Get pages tree root
 */
export function getPagesRoot(doc: PDFDocument): PDFDictionary | null {
  const catalog = getCatalog(doc);
  if (!catalog) return null;

  const pagesRef = catalog.entries.get('Pages');
  if (!pagesRef) return null;

  const pages = resolveReference(doc, pagesRef);
  if (!isDictionary(pages)) return null;

  return pages;
}

/**
 * Get all pages as array
 */
export function getPages(doc: PDFDocument): PDFDictionary[] {
  const pagesRoot = getPagesRoot(doc);
  if (!pagesRoot) return [];

  const pages: PDFDictionary[] = [];
  collectPages(doc, pagesRoot, pages);
  return pages;
}

/**
 * Recursively collect pages from pages tree.
 * Includes depth limit and visited-set cycle detection.
 */
function collectPages(
  doc: PDFDocument,
  node: PDFDictionary,
  pages: PDFDictionary[],
  visited: Set<string> = new Set(),
  depth: number = 0
): void {
  const maxDepth = doc.history.limits.maxDepth;
  if (depth > maxDepth) {
    doc.diagnostics.push({
      code: 'page-tree-depth',
      message: `Exceeded maximum page tree depth (${maxDepth}). Stopping traversal.`,
    });
    return;
  }

  const typeObj = node.entries.get('Type');
  if (typeObj?.type !== 'name') return;

  if (typeObj.value === 'Page') {
    pages.push(node);
    return;
  }

  if (typeObj.value === 'Pages') {
    const kidsObj = node.entries.get('Kids');
    if (!kidsObj) return;

    const kids = resolveReference(doc, kidsObj);
    if (!isArray(kids)) return;

    for (const kidRef of kids.items) {
      // Track references to detect cycles
      if (kidRef.type === 'reference') {
        const refKey = objectKey(kidRef.objectNumber, kidRef.generation);
        if (visited.has(refKey)) {
          doc.diagnostics.push({
            code: 'page-tree-cycle',
            message: `Cyclic page tree reference detected: ${refKey}. Skipping.`,
          });
          continue;
        }
        visited.add(refKey);
      }

      const kid = resolveReference(doc, kidRef);
      if (isDictionary(kid)) {
        collectPages(doc, kid, pages, visited, depth + 1);
      }
    }
  }
}

/**
 * Get page count
 */
export function getPageCount(doc: PDFDocument): number {
  const pagesRoot = getPagesRoot(doc);
  if (!pagesRoot) return 0;

  const countObj = pagesRoot.entries.get('Count');
  if (countObj?.type !== 'number') return 0;

  return countObj.value;
}

/**
 * Get specific page by index (0-based)
 */
export function getPage(doc: PDFDocument, index: number): PDFDictionary | null {
  const pages = getPages(doc);
  return pages[index] ?? null;
}

// ============================================================================
// Dictionary Helpers
// ============================================================================

/**
 * Get dictionary entry, resolving references
 */
export function getDictEntry(doc: PDFDocument, dict: PDFDictionary, key: string): PDFObject | null {
  const value = dict.entries.get(key);
  if (!value) return null;
  return resolveReference(doc, value);
}

/**
 * Get dictionary entry as string.
 * Handles PDF string encoding (PDFDocEncoding / UTF-16BE with BOM)
 * and also handles names that contain UTF-16BE encoded text.
 */
export function getDictString(doc: PDFDocument, dict: PDFDictionary, key: string): string | null {
  const value = getDictEntry(doc, dict, key);
  if (!value) return null;

  if (value.type === 'string' || value.type === 'hexstring') {
    return decodePDFString(value.raw);
  }

  if (value.type === 'name') {
    // Names may contain UTF-16BE with BOM, encoded via #XX hex escapes.
    // The name decoder resolves #XX to raw bytes but interprets them as Latin-1.
    // We need to convert back to bytes and check for UTF-16BE BOM.
    return decodePDFNameValue(value.value);
  }

  return null;
}

/**
 * Get dictionary entry as number
 */
export function getDictNumber(doc: PDFDocument, dict: PDFDictionary, key: string): number | null {
  const value = getDictEntry(doc, dict, key);
  if (value?.type !== 'number') return null;
  return value.value;
}

/**
 * Get dictionary entry as array
 */
export function getDictArray(doc: PDFDocument, dict: PDFDictionary, key: string): PDFArray | null {
  const value = getDictEntry(doc, dict, key);
  if (value?.type !== 'array') return null;
  return value;
}

/**
 * Get dictionary entry as dictionary
 */
export function getDictDict(
  doc: PDFDocument,
  dict: PDFDictionary,
  key: string
): PDFDictionary | null {
  const value = getDictEntry(doc, dict, key);
  if (value?.type !== 'dictionary') return null;
  return value;
}

// ============================================================================
// Document Info
// ============================================================================

/**
 * Get document title
 */
export function getTitle(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Title');
}

/**
 * Get document author
 */
export function getAuthor(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Author');
}

/**
 * Get document subject
 */
export function getSubject(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Subject');
}

/**
 * Get document keywords
 */
export function getKeywords(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Keywords');
}

/**
 * Get document creator application
 */
export function getCreator(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Creator');
}

/**
 * Get document producer
 */
export function getProducer(doc: PDFDocument): string | null {
  const info = getInfo(doc);
  if (!info) return null;
  return getDictString(doc, info, 'Producer');
}

// Import getInfo from parser
import { getInfo } from './parser.js';
