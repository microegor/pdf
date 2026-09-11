import { describe, expect, it } from "vitest";
import { getCatalog, getInfo, getObject, getTrailer, parse, resolveReference } from "../parser.js";
import { buildSingleRevisionPDF } from "./fixtures.js";
import { createReference } from "../types.js";

describe("parser", () => {
  it("parse valid PDF and access trailer/catalog", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(doc.version).toBeTruthy();
    expect(getTrailer(doc)).not.toBeNull();
    expect(getCatalog(doc)?.entries.get("Type")).toBeDefined();
    expect(getInfo(doc)).toBeNull();
  });
  it("getObject and resolveReference", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog /Pages 2 0 R>>" },
        { objNum: 2, genNum: 0, content: "<</Type /Pages /Count 0>>" },
      ],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const obj = getObject(doc, 1, 0);
    expect(obj?.type).toBe("dictionary");
    const ref = createReference(2, 0);
    const resolved = resolveReference(doc, ref);
    expect(resolved.type).toBe("dictionary");
    // resolving non-reference returns itself
    expect(resolveReference(doc, { type: "null" }).type).toBe("null");
    expect(getObject(doc, 999, 0)).toBeNull();
  });
  it("throws on invalid header", () => {
    expect(() => parse(new TextEncoder().encode("BAD header\n%%EOF\nstartxref\n0\n%%EOF"))).toThrow(
      /Invalid PDF header/,
    );
  });
  it("throws when %%EOF missing", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n0\n");
    expect(() => parse(pdf)).toThrow(/%%EOF/);
  });
  it("throws when startxref missing", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    expect(() => parse(pdf)).toThrow(/startxref/);
  });
  it("throws when file too large", () => {
    const pdf = buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }]);
    expect(() => parse(pdf, { limits: { maxFileBytes: 1 } })).toThrow(/file size/);
  });
  it("validates limits", () => {
    const pdf = buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }]);
    expect(() => parse(pdf, { limits: { maxObjects: -1 } as any })).toThrow(/Invalid ParseLimits/);
  });
  it("getInfo returns Info dict", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog>>" },
        { objNum: 2, genNum: 0, content: "<</Title (t)>>" },
      ],
      "/Root 1 0 R /Info 2 0 R",
    );
    const doc = parse(pdf);
    expect(getInfo(doc)?.entries.get("Title")).toBeDefined();
  });
  it("resolveReference handles missing target as null", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(resolveReference(doc, createReference(999, 0)).type).toBe("null");
  });
});
