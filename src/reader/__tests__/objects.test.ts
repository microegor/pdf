import { describe, expect, it } from 'vitest';
import { createCursor } from '../buffer.js';
import { parseIndirectObject, parseObject } from '../objects.js';

describe('Object parsing', () => {
  describe('parseObject', () => {
    it('should parse null', () => {
      const buffer = new Uint8Array([0x6e, 0x75, 0x6c, 0x6c]); // "null"
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('null');
    });

    it('should parse true', () => {
      const buffer = new Uint8Array([0x74, 0x72, 0x75, 0x65]); // "true"
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('boolean');
      expect(obj.type === 'boolean' && obj.value).toBe(true);
    });

    it('should parse false', () => {
      const buffer = new Uint8Array([0x66, 0x61, 0x6c, 0x73, 0x65]); // "false"
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('boolean');
      expect(obj.type === 'boolean' && obj.value).toBe(false);
    });

    it('should parse number', () => {
      const buffer = new Uint8Array([0x34, 0x32]); // "42"
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('number');
      expect(obj.type === 'number' && obj.value).toBe(42);
    });

    it('should parse name', () => {
      const buffer = new Uint8Array([0x2f, 0x54, 0x79, 0x70, 0x65]); // "/Type"
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('name');
      expect(obj.type === 'name' && obj.value).toBe('Type');
    });

    it('should parse array', () => {
      // "[1 2 3]"
      const buffer = new Uint8Array([0x5b, 0x31, 0x20, 0x32, 0x20, 0x33, 0x5d]);
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('array');
      if (obj.type === 'array') {
        expect(obj.items.length).toBe(3);
        expect(obj.items[0]?.type).toBe('number');
        expect(obj.items[0]?.type === 'number' && obj.items[0]?.value).toBe(1);
      }
    });

    it('should parse dictionary', () => {
      // "<< /Type /Page >>"
      const buffer = new Uint8Array([
        0x3c, 0x3c, 0x20, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x20, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x20,
        0x3e, 0x3e,
      ]);
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('dictionary');
      if (obj.type === 'dictionary') {
        expect(obj.entries.has('Type')).toBe(true);
        const typeEntry = obj.entries.get('Type');
        expect(typeEntry?.type).toBe('name');
        expect(typeEntry?.type === 'name' && typeEntry?.value).toBe('Page');
      }
    });

    it('should parse reference', () => {
      // "1 0 R"
      const buffer = new Uint8Array([0x31, 0x20, 0x30, 0x20, 0x52]);
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('reference');
      if (obj.type === 'reference') {
        expect(obj.objectNumber).toBe(1);
        expect(obj.generation).toBe(0);
      }
    });

    it('should parse literal string', () => {
      // "(Hello)"
      const buffer = new Uint8Array([0x28, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x29]);
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('string');
      if (obj.type === 'string') {
        expect(new TextDecoder().decode(obj.raw)).toBe('Hello');
      }
    });

    it('should parse hex string', () => {
      // "<48656C6C6F>" = "Hello"
      const buffer = new Uint8Array([
        0x3c, 0x34, 0x38, 0x36, 0x35, 0x36, 0x43, 0x36, 0x43, 0x36, 0x46, 0x3e,
      ]);
      const cursor = createCursor(buffer);

      const obj = parseObject(cursor);

      expect(obj.type).toBe('hexstring');
      if (obj.type === 'hexstring') {
        expect(new TextDecoder().decode(obj.raw)).toBe('Hello');
      }
    });
  });

  describe('parseIndirectObject', () => {
    it('should parse indirect object', () => {
      // "1 0 obj\n42\nendobj"
      const buffer = new Uint8Array([
        0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x34, 0x32, 0x0a, 0x65, 0x6e, 0x64, 0x6f,
        0x62, 0x6a,
      ]);
      const cursor = createCursor(buffer);

      const result = parseIndirectObject(cursor);

      expect(result.objectNumber).toBe(1);
      expect(result.generation).toBe(0);
      expect(result.value.type).toBe('number');
      expect(result.value.type === 'number' && result.value.value).toBe(42);
    });
  });
});
