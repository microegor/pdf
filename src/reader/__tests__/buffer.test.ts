import { describe, expect, it } from 'vitest';
import {
  bytesToString,
  createCursor,
  findPattern,
  findPatternBackward,
  isDigit,
  isHexDigit,
  isWhitespace,
  matchBytes,
  parseInteger,
  skipWhitespace,
} from '../buffer.js';

describe('Buffer utilities', () => {
  describe('createCursor', () => {
    it('should create cursor at position 0 by default', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      const cursor = createCursor(buffer);

      expect(cursor.position).toBe(0);
      expect(cursor.buffer).toBe(buffer);
    });

    it('should create cursor at specified position', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      const cursor = createCursor(buffer, 2);

      expect(cursor.position).toBe(2);
    });
  });

  describe('isWhitespace', () => {
    it('should return true for whitespace characters', () => {
      expect(isWhitespace(0x20)).toBe(true); // space
      expect(isWhitespace(0x09)).toBe(true); // tab
      expect(isWhitespace(0x0a)).toBe(true); // LF
      expect(isWhitespace(0x0d)).toBe(true); // CR
      expect(isWhitespace(0x0c)).toBe(true); // FF
      expect(isWhitespace(0x00)).toBe(true); // NULL
    });

    it('should return false for non-whitespace', () => {
      expect(isWhitespace(0x41)).toBe(false); // 'A'
      expect(isWhitespace(0x30)).toBe(false); // '0'
    });
  });

  describe('isDigit', () => {
    it('should return true for digits', () => {
      for (let i = 0x30; i <= 0x39; i++) {
        expect(isDigit(i)).toBe(true);
      }
    });

    it('should return false for non-digits', () => {
      expect(isDigit(0x41)).toBe(false); // 'A'
      expect(isDigit(0x20)).toBe(false); // space
    });
  });

  describe('isHexDigit', () => {
    it('should return true for hex digits', () => {
      // 0-9
      for (let i = 0x30; i <= 0x39; i++) {
        expect(isHexDigit(i)).toBe(true);
      }
      // A-F
      for (let i = 0x41; i <= 0x46; i++) {
        expect(isHexDigit(i)).toBe(true);
      }
      // a-f
      for (let i = 0x61; i <= 0x66; i++) {
        expect(isHexDigit(i)).toBe(true);
      }
    });

    it('should return false for non-hex digits', () => {
      expect(isHexDigit(0x47)).toBe(false); // 'G'
      expect(isHexDigit(0x67)).toBe(false); // 'g'
    });
  });

  describe('matchBytes', () => {
    it('should match pattern at offset', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      const pattern = new Uint8Array([2, 3, 4]);

      expect(matchBytes(buffer, 1, pattern)).toBe(true);
    });

    it('should not match at wrong offset', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      const pattern = new Uint8Array([2, 3, 4]);

      expect(matchBytes(buffer, 0, pattern)).toBe(false);
    });

    it('should not match if buffer too short', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      const pattern = new Uint8Array([2, 3, 4]);

      expect(matchBytes(buffer, 1, pattern)).toBe(false);
    });
  });

  describe('skipWhitespace', () => {
    it('should skip whitespace characters', () => {
      const buffer = new Uint8Array([0x20, 0x09, 0x0a, 0x41]); // "  \n" + "A"
      const cursor = createCursor(buffer);

      skipWhitespace(cursor);

      expect(cursor.position).toBe(3);
    });

    it('should not skip non-whitespace', () => {
      const buffer = new Uint8Array([0x41, 0x42]); // "AB"
      const cursor = createCursor(buffer);

      skipWhitespace(cursor);

      expect(cursor.position).toBe(0);
    });
  });

  describe('findPattern', () => {
    it('should find pattern in buffer', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 3, 4]);
      const pattern = new Uint8Array([3, 4]);

      expect(findPattern(buffer, pattern)).toBe(2);
    });

    it('should return -1 if not found', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      const pattern = new Uint8Array([6, 7]);

      expect(findPattern(buffer, pattern)).toBe(-1);
    });
  });

  describe('findPatternBackward', () => {
    it('should find pattern searching backwards', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 3, 4]);
      const pattern = new Uint8Array([3, 4]);

      expect(findPatternBackward(buffer, pattern)).toBe(5);
    });
  });

  describe('bytesToString', () => {
    it('should convert bytes to string', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

      expect(bytesToString(buffer)).toBe('Hello');
    });
  });

  describe('parseInteger', () => {
    it('should parse positive integer', () => {
      const buffer = new Uint8Array([0x31, 0x32, 0x33]); // "123"

      expect(parseInteger(buffer, 0, 3)).toBe(123);
    });

    it('should parse negative integer', () => {
      const buffer = new Uint8Array([0x2d, 0x31, 0x32, 0x33]); // "-123"

      expect(parseInteger(buffer, 0, 4)).toBe(-123);
    });
  });
});
