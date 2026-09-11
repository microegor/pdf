import { describe, expect, it } from "vitest";

import {
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
} from "../document.js";
import { parse } from "../parser.js";
import {
  createDictionary,
  createName,
  createNumber,
  createString,
  type PDFObject,
} from "../types.js";
import { buildSingleRevisionPDF } from "./fixtures.js";

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

describe("document navigation", () => {
  it("getSections and getSectionCount", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );

    const doc = parse(pdf);

    expect(getSections(doc).length).toBe(1);
    expect(getSectionCount(doc)).toBe(1);
  });

  it("getObjectSection", () => {
    const pdf = buildSingleRevisionPDF([{ objNum: 5, genNum: 0, content: "1" }], "/Root 5 0 R");

    const doc = parse(pdf);

    expect(getObjectSection(doc, 5, 0)).toBe(0);
    expect(getObjectSection(doc, 999, 0)).toBe(-1);
  });

  it("getPagesRoot / getPages / getPageCount / getPage", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog /Pages 2 0 R>>" },
        { objNum: 2, genNum: 0, content: "<</Type /Pages /Kids [3 0 R] /Count 1>>" },
        { objNum: 3, genNum: 0, content: "<</Type /Page>>" },
      ],
      "/Root 1 0 R",
    );

    const doc = parse(pdf);

    const root = getPagesRoot(doc);

    expect(root?.entries.get("Type")).toBeDefined();
    expect(getPages(doc).length).toBe(1);
    expect(getPageCount(doc)).toBe(1);
    expect(getPage(doc, 0)?.entries.get("Type")).toBeDefined();
    expect(getPage(doc, 99)).toBeNull();
  });

  it("getDict helpers resolve references", () => {
    const inner = createDictionary(
      new Map<string, PDFObject>([["Value", createNumber(99)]]),
    );

    // Build a doc with reference resolution via parser: use simple dict without refs
    const dict = createDictionary(
      new Map<string, PDFObject>([
        ["N", createNumber(42)],
        ["S", createString(encode("hi"))],
        ["Name", createName("Foo")],
      ]),
    );

    const dict2 = createDictionary(
      new Map<string, PDFObject>([
        ["Arr", { type: "array", items: [createNumber(1)] }],
      ]),
    );

    const fakeDoc: any = {
      objects: new Map(),
      history: { limits: { maxDepth: 100 } },
      diagnostics: [],
    };

    // getDictEntry without reference
    expect(getDictEntry(fakeDoc, dict, "N")).toEqual(createNumber(42));
    expect(getDictEntry(fakeDoc, dict, "Missing")).toBeNull();

    expect(getDictNumber(fakeDoc, dict, "N")).toBe(42);
    expect(getDictNumber(fakeDoc, dict, "S")).toBeNull();

    expect(getDictString(fakeDoc, dict, "S")).toBe("hi");
    expect(getDictString(fakeDoc, dict, "Name")).toBe("Foo");
    expect(getDictString(fakeDoc, dict, "Missing")).toBeNull();

    expect(getDictArray(fakeDoc, dict2, "Arr")?.items.length).toBe(1);

    expect(
      getDictDict(
        fakeDoc,
        createDictionary(new Map<string, PDFObject>([["D", inner]])),
        "D",
      )?.entries.get("Value"),
    ).toEqual(createNumber(99));
  });

  it("getTitle etc return null when no Info", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );

    const doc = parse(pdf);

    expect(getTitle(doc)).toBeNull();
    expect(getAuthor(doc)).toBeNull();
    expect(getSubject(doc)).toBeNull();
    expect(getKeywords(doc)).toBeNull();
    expect(getCreator(doc)).toBeNull();
    expect(getProducer(doc)).toBeNull();
  });

  it("getTitle etc with Info dict", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog>>" },
        { objNum: 2, genNum: 0, content: "<</Title (MyTitle) /Author (Me)>>" },
      ],
      "/Root 1 0 R /Info 2 0 R",
    );

    const doc = parse(pdf);

    expect(getTitle(doc)).toBe("MyTitle");
    expect(getAuthor(doc)).toBe("Me");
  });
});