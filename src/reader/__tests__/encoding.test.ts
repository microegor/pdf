import { describe, expect, it } from "vitest";
import { decodePDFNameValue, decodePDFString } from "../encoding.js";

describe("decodePDFString", () => {
  it("empty raw returns empty string", () => {
    expect(decodePDFString(new Uint8Array([]))).toBe("");
  });
  it("decodes PDFDocEncoding euro and undefined bytes", () => {
    expect(decodePDFString(new Uint8Array([0xa0]))).toBe("\u20ac");
    expect(decodePDFString(new Uint8Array([0x9f]))).toBe("\ufffd");
    expect(decodePDFString(new Uint8Array([0x80]))).toBe("\u2022");
  });
  it("decodes ASCII via PDFDocEncoding", () => {
    expect(decodePDFString(new TextEncoder().encode("Hello"))).toBe("Hello");
  });
  it("decodes UTF-16BE with BOM", () => {
    const raw = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]); // "Hi"
    expect(decodePDFString(raw)).toBe("Hi");
  });
  it("decodes large UTF-16BE without stack overflow", () => {
    const codeUnitCount = 150_000;
    const raw = new Uint8Array(2 + codeUnitCount * 2);
    raw[0] = 0xfe;
    raw[1] = 0xff;
    for (let i = 2; i < raw.length; i += 2) {
      raw[i] = 0;
      raw[i + 1] = 0x41;
    }
    expect(decodePDFString(raw)).toBe("A".repeat(codeUnitCount));
  });
  it("PDFDocEncoding special 0x18..0x1f mapping", () => {
    // 24 -> 0x02d8 etc per pdfDocEncodingToUnicode table
    expect(decodePDFString(new Uint8Array([24])).codePointAt(0)).toBe(0x02d8);
    expect(decodePDFString(new Uint8Array([31])).codePointAt(0)).toBe(0x02dc);
  });
});

describe("decodePDFNameValue", () => {
  it("returns short name as-is", () => {
    expect(decodePDFNameValue("A")).toBe("A");
    expect(decodePDFNameValue("")).toBe("");
  });
  it("returns name without BOM handling", () => {
    expect(decodePDFNameValue("Type")).toBe("Type");
  });
  it("decodes UTF-16BE in name when BOM present", () => {
    // Build a name string with raw bytes FE FF 00 48 00 69 encoded as chars
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
    let name = "";
    for (const b of bytes) name += String.fromCharCode(b);
    expect(decodePDFNameValue(name)).toBe("Hi");
  });
});
