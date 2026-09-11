import { describe, expect, it } from "vitest";
import {
  advance,
  bytesToString,
  createCursor,
  hasBytes,
  hasMore,
  hexValue,
  isDelimiter,
  isEOL,
  isNumberStart,
  matchPattern,
  parseFloatFromBytes,
  peek,
  peekBytes,
  read,
  remaining,
  seek,
  skipComment,
  skipLine,
  skipWhitespaceAndComments,
  slice,
} from "../buffer.js";

describe("Buffer extended utilities", () => {
  describe("hasMore / hasBytes", () => {
    it("hasMore returns false at end", () => {
      const cursor = createCursor(new Uint8Array([1, 2]));
      expect(hasMore(cursor)).toBe(true);
      cursor.position = 2;
      expect(hasMore(cursor)).toBe(false);
    });
    it("hasBytes checks remaining length", () => {
      const cursor = createCursor(new Uint8Array([1, 2, 3]));
      expect(hasBytes(cursor, 3)).toBe(true);
      expect(hasBytes(cursor, 4)).toBe(false);
      cursor.position = 1;
      expect(hasBytes(cursor, 2)).toBe(true);
      expect(hasBytes(cursor, 3)).toBe(false);
    });
  });

  describe("peek / peekBytes / read / advance / seek / remaining / slice", () => {
    it("peek returns current byte and -1 at EOF", () => {
      const cursor = createCursor(new Uint8Array([0x41, 0x42]));
      expect(peek(cursor)).toBe(0x41);
      cursor.position = 2;
      expect(peek(cursor)).toBe(-1);
    });
    it("peekBytes returns subarray view", () => {
      const cursor = createCursor(new Uint8Array([1, 2, 3, 4]));
      expect(Array.from(peekBytes(cursor, 2))).toEqual([1, 2]);
      cursor.position = 2;
      expect(Array.from(peekBytes(cursor, 2))).toEqual([3, 4]);
    });
    it("read advances cursor", () => {
      const cursor = createCursor(new Uint8Array([10, 20]));
      expect(read(cursor)).toBe(10);
      expect(cursor.position).toBe(1);
      expect(read(cursor)).toBe(20);
      expect(read(cursor)).toBe(-1);
    });
    it("advance and seek modify position", () => {
      const cursor = createCursor(new Uint8Array([1, 2, 3]));
      advance(cursor, 2);
      expect(cursor.position).toBe(2);
      advance(cursor);
      expect(cursor.position).toBe(3);
      seek(cursor, 0);
      expect(cursor.position).toBe(0);
    });
    it("remaining returns tail subarray", () => {
      const cursor = createCursor(new Uint8Array([1, 2, 3, 4]));
      cursor.position = 2;
      expect(Array.from(remaining(cursor))).toEqual([3, 4]);
    });
    it("slice returns offset subarray", () => {
      const cursor = createCursor(new Uint8Array([1, 2, 3, 4]));
      expect(Array.from(slice(cursor, 1, 3))).toEqual([2, 3]);
      cursor.position = 1;
      expect(Array.from(slice(cursor, 0, 2))).toEqual([2, 3]);
    });
  });

  describe("isEOL / isDelimiter / isNumberStart", () => {
    it("isEOL true for LF and CR", () => {
      expect(isEOL(0x0a)).toBe(true);
      expect(isEOL(0x0d)).toBe(true);
      expect(isEOL(0x20)).toBe(false);
    });
    it("isDelimiter for delimiter bytes", () => {
      expect(isDelimiter(0x28)).toBe(true); // (
      expect(isDelimiter(0x29)).toBe(true); // )
      expect(isDelimiter(0x3c)).toBe(true); // <
      expect(isDelimiter(0x3e)).toBe(true); // >
      expect(isDelimiter(0x5b)).toBe(true); // [
      expect(isDelimiter(0x5d)).toBe(true); // ]
      expect(isDelimiter(0x7b)).toBe(true); // {
      expect(isDelimiter(0x7d)).toBe(true); // }
      expect(isDelimiter(0x2f)).toBe(true); // /
      expect(isDelimiter(0x25)).toBe(true); // %
      expect(isDelimiter(0x41)).toBe(false);
    });
    it("isNumberStart", () => {
      expect(isNumberStart(0x30)).toBe(true); // 0
      expect(isNumberStart(0x2b)).toBe(true); // +
      expect(isNumberStart(0x2d)).toBe(true); // -
      expect(isNumberStart(0x2e)).toBe(true); // .
      expect(isNumberStart(0x41)).toBe(false);
    });
  });

  describe("matchPattern / skipLine / skipComment / skipWhitespaceAndComments", () => {
    it("matchPattern matches at cursor", () => {
      const buffer = new Uint8Array([1, 2, 3]);
      const cursor = createCursor(buffer);
      expect(matchPattern(cursor, new Uint8Array([1, 2]))).toBe(true);
      expect(matchPattern(cursor, new Uint8Array([2, 3]))).toBe(false);
      cursor.position = 1;
      expect(matchPattern(cursor, new Uint8Array([2, 3]))).toBe(true);
    });
    it("skipLine handles LF, CR, CRLF", () => {
      const c1 = createCursor(new Uint8Array([0x41, 0x0a, 0x42]));
      skipLine(c1);
      expect(c1.position).toBe(2);
      const c2 = createCursor(new Uint8Array([0x41, 0x0d, 0x42]));
      skipLine(c2);
      expect(c2.position).toBe(2);
      const c3 = createCursor(new Uint8Array([0x41, 0x0d, 0x0a, 0x42]));
      skipLine(c3);
      expect(c3.position).toBe(3);
    });
    it("skipComment skips from % to EOL", () => {
      const cursor = createCursor(new Uint8Array([0x25, 0x61, 0x0a, 0x42])); // %a\nB
      skipComment(cursor);
      expect(cursor.position).toBe(3);
    });
    it("skipComment does nothing if not %", () => {
      const cursor = createCursor(new Uint8Array([0x41, 0x0a]));
      skipComment(cursor);
      expect(cursor.position).toBe(0);
    });
    it("skipWhitespaceAndComments skips both", () => {
      const cursor = createCursor(new Uint8Array([0x20, 0x25, 0x61, 0x0a, 0x20, 0x41]));
      skipWhitespaceAndComments(cursor);
      expect(cursor.position).toBe(5);
      expect(cursor.buffer[cursor.position]).toBe(0x41);
    });
  });

  describe("hexValue / parseFloatFromBytes / bytesToString chunked", () => {
    it("hexValue converts correctly", () => {
      expect(hexValue(0x30)).toBe(0);
      expect(hexValue(0x39)).toBe(9);
      expect(hexValue(0x41)).toBe(10);
      expect(hexValue(0x46)).toBe(15);
      expect(hexValue(0x61)).toBe(10);
      expect(hexValue(0x66)).toBe(15);
      expect(hexValue(0x47)).toBe(-1);
    });
    it("parseFloatFromBytes", () => {
      const buf = new TextEncoder().encode("3.14");
      expect(parseFloatFromBytes(buf, 0, buf.length)).toBeCloseTo(3.14);
      const buf2 = new TextEncoder().encode("-2.5");
      expect(parseFloatFromBytes(buf2, 0, buf2.length)).toBeCloseTo(-2.5);
    });
    it("bytesToString handles large buffer chunked", () => {
      const size = 0x9000;
      const bytes = new Uint8Array(size).fill(0x41);
      const str = bytesToString(bytes);
      expect(str.length).toBe(size);
      expect(str[0]).toBe("A");
      expect(str[size - 1]).toBe("A");
      // 0x80..0x9f preservation
      expect(bytesToString(new Uint8Array([0x80, 0x9f]))).toBe("\u0080\u009f");
    });
  });
});
