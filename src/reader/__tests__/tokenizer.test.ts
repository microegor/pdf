import { describe, expect, it } from 'vitest';
import { createCursor } from '../buffer.js';
import { nextToken, peekToken } from '../tokenizer.js';

describe('Tokenizer', () => {
  describe('nextToken', () => {
    it('should tokenize number', () => {
      const buffer = new Uint8Array([0x31, 0x32, 0x33]); // "123"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('number');
      expect(token?.value).toBe(123);
    });

    it('should tokenize negative number', () => {
      const buffer = new Uint8Array([0x2d, 0x34, 0x32]); // "-42"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('number');
      expect(token?.value).toBe(-42);
    });

    it('should tokenize float', () => {
      const buffer = new Uint8Array([0x33, 0x2e, 0x31, 0x34]); // "3.14"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('number');
      expect(token?.value).toBeCloseTo(3.14);
    });

    it('should tokenize name', () => {
      const buffer = new Uint8Array([0x2f, 0x54, 0x79, 0x70, 0x65]); // "/Type"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('name');
      expect(token?.value).toBe('Type');
    });

    it('should tokenize keyword true', () => {
      const buffer = new Uint8Array([0x74, 0x72, 0x75, 0x65]); // "true"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('keyword');
      expect(token?.value).toBe('true');
    });

    it('should tokenize keyword false', () => {
      const buffer = new Uint8Array([0x66, 0x61, 0x6c, 0x73, 0x65]); // "false"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('keyword');
      expect(token?.value).toBe('false');
    });

    it('should tokenize keyword null', () => {
      const buffer = new Uint8Array([0x6e, 0x75, 0x6c, 0x6c]); // "null"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('keyword');
      expect(token?.value).toBe('null');
    });

    it('should tokenize array start', () => {
      const buffer = new Uint8Array([0x5b]); // "["
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('array_start');
    });

    it('should tokenize array end', () => {
      const buffer = new Uint8Array([0x5d]); // "]"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('array_end');
    });

    it('should tokenize dict start', () => {
      const buffer = new Uint8Array([0x3c, 0x3c]); // "<<"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('dict_start');
    });

    it('should tokenize dict end', () => {
      const buffer = new Uint8Array([0x3e, 0x3e]); // ">>"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('dict_end');
    });

    it('should tokenize literal string', () => {
      const buffer = new Uint8Array([0x28, 0x48, 0x69, 0x29]); // "(Hi)"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('string');
    });

    it('should tokenize hex string', () => {
      const buffer = new Uint8Array([0x3c, 0x34, 0x38, 0x36, 0x39, 0x3e]); // "<4869>"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('hexstring');
    });

    it('should skip whitespace', () => {
      const buffer = new Uint8Array([0x20, 0x20, 0x31, 0x32, 0x33]); // "  123"
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('number');
      expect(token?.value).toBe(123);
    });

    it('should skip comments', () => {
      const buffer = new Uint8Array([
        0x25,
        0x63,
        0x6f,
        0x6d,
        0x6d,
        0x65,
        0x6e,
        0x74,
        0x0a, // "%comment\n"
        0x31,
        0x32,
        0x33, // "123"
      ]);
      const cursor = createCursor(buffer);

      const token = nextToken(cursor);

      expect(token?.type).toBe('number');
      expect(token?.value).toBe(123);
    });
  });

  describe('peekToken', () => {
    it('should not advance cursor', () => {
      const buffer = new Uint8Array([0x31, 0x32, 0x33]); // "123"
      const cursor = createCursor(buffer);

      const token1 = peekToken(cursor);
      const token2 = peekToken(cursor);

      expect(token1?.type).toBe('number');
      expect(token2?.type).toBe('number');
      expect(cursor.position).toBe(0);
    });
  });
});
