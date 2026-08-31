/**
 * Semantic Diff Tests
 */

import { describe, expect, it } from "vitest";
import { diffDictionaries, diffStreams, equalPDFObject } from "../diff.js";
import {
  createArray,
  createBoolean,
  createDictionary,
  createName,
  createNull,
  createNumber,
  createReference,
  createStream,
  createString,
} from "../types.js";

describe("equalPDFObject", () => {
  it("null equals null", () => {
    expect(equalPDFObject(createNull(), createNull())).toBe(true);
  });

  it("null does not equal boolean", () => {
    expect(equalPDFObject(createNull(), createBoolean(true))).toBe(false);
  });

  it("same boolean values are equal", () => {
    expect(equalPDFObject(createBoolean(true), createBoolean(true))).toBe(true);
    expect(equalPDFObject(createBoolean(false), createBoolean(false))).toBe(true);
    expect(equalPDFObject(createBoolean(true), createBoolean(false))).toBe(false);
  });

  it("same numbers are equal", () => {
    expect(equalPDFObject(createNumber(42), createNumber(42))).toBe(true);
    expect(equalPDFObject(createNumber(42), createNumber(43))).toBe(false);
    expect(equalPDFObject(createNumber(0), createNumber(-0))).toBe(true);
  });

  it("same string raw bytes are equal", () => {
    const a = createString(new Uint8Array([72, 101, 108, 108, 111]));
    const b = createString(new Uint8Array([72, 101, 108, 108, 111]));
    const c = createString(new Uint8Array([87, 111, 114, 108, 100]));
    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
  });

  it("same names are equal", () => {
    expect(equalPDFObject(createName("Type"), createName("Type"))).toBe(true);
    expect(equalPDFObject(createName("Type"), createName("Subtype"))).toBe(false);
  });

  it("same references are equal", () => {
    expect(equalPDFObject(createReference(1, 0), createReference(1, 0))).toBe(true);
    expect(equalPDFObject(createReference(1, 0), createReference(2, 0))).toBe(false);
    expect(equalPDFObject(createReference(1, 0), createReference(1, 1))).toBe(false);
  });

  it("arrays compared by items", () => {
    const a = createArray([createNumber(1), createNumber(2)]);
    const b = createArray([createNumber(1), createNumber(2)]);
    const c = createArray([createNumber(1), createNumber(3)]);
    const d = createArray([createNumber(1)]);
    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
    expect(equalPDFObject(a, d)).toBe(false);
  });

  it("dictionaries compared by entries", () => {
    const a = createDictionary(new Map([["Key", createNumber(1)]]));
    const b = createDictionary(new Map([["Key", createNumber(1)]]));
    const c = createDictionary(new Map([["Key", createNumber(2)]]));
    const d = createDictionary(new Map([["Other", createNumber(1)]]));
    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
    expect(equalPDFObject(a, d)).toBe(false);
  });

  it("streams compared by dict + data", () => {
    const dictA = createDictionary(new Map([["Length", createNumber(5)]]));
    const dataA = new Uint8Array([1, 2, 3, 4, 5]);
    const a = createStream(dictA, dataA);

    const dictB = createDictionary(new Map([["Length", createNumber(5)]]));
    const dataB = new Uint8Array([1, 2, 3, 4, 5]);
    const b = createStream(dictB, dataB);

    const dataC = new Uint8Array([5, 4, 3, 2, 1]);
    const c = createStream(dictA, dataC);

    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
  });

  it("undefined/null handling", () => {
    expect(equalPDFObject(undefined, undefined)).toBe(true);
    expect(equalPDFObject(null, null)).toBe(true);
    expect(equalPDFObject(createNull(), undefined)).toBe(false);
    expect(equalPDFObject(undefined, createNull())).toBe(false);
  });

  it("handles empty arrays and dictionaries", () => {
    expect(equalPDFObject(createArray([]), createArray([]))).toBe(true);
    const empty1 = createDictionary(new Map());
    const empty2 = createDictionary(new Map());
    expect(equalPDFObject(empty1, empty2)).toBe(true);
  });
});

describe("diffDictionaries", () => {
  it("detects added keys", () => {
    const old = createDictionary(new Map([["A", createNumber(1)]]));
    const newer = createDictionary(
      new Map([
        ["A", createNumber(1)],
        ["B", createNumber(2)],
      ]),
    );
    const diff = diffDictionaries(old, newer);
    expect(diff.addedCount).toBe(1);
    expect(diff.removedCount).toBe(0);
    expect(diff.changedCount).toBe(0);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.entries.find((e) => e.key === "B")?.kind).toBe("added");
  });

  it("detects removed keys", () => {
    const old = createDictionary(
      new Map([
        ["A", createNumber(1)],
        ["B", createNumber(2)],
      ]),
    );
    const newer = createDictionary(new Map([["A", createNumber(1)]]));
    const diff = diffDictionaries(old, newer);
    expect(diff.removedCount).toBe(1);
    expect(diff.entries.find((e) => e.key === "B")?.kind).toBe("removed");
  });

  it("detects changed values", () => {
    const old = createDictionary(new Map([["A", createNumber(1)]]));
    const newer = createDictionary(new Map([["A", createNumber(2)]]));
    const diff = diffDictionaries(old, newer);
    expect(diff.changedCount).toBe(1);
    expect(diff.entries.find((e) => e.key === "A")?.kind).toBe("changed");
  });

  it("detects unchanged keys", () => {
    const old = createDictionary(new Map([["A", createNumber(1)]]));
    const newer = createDictionary(new Map([["A", createNumber(1)]]));
    const diff = diffDictionaries(old, newer);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.addedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
    expect(diff.changedCount).toBe(0);
  });

  it("handles null/undefined inputs", () => {
    const dict = createDictionary(new Map([["A", createNumber(1)]]));
    const diff1 = diffDictionaries(null, dict);
    expect(diff1.addedCount).toBe(1);

    const diff2 = diffDictionaries(dict, null);
    expect(diff2.removedCount).toBe(1);

    const diff3 = diffDictionaries(null, null);
    expect(diff3.entries.length).toBe(0);
  });
});

describe("diffStreams", () => {
  it("detects raw data change", () => {
    const dict = createDictionary(new Map([["Length", createNumber(3)]]));
    const old = createStream(dict, new Uint8Array([1, 2, 3]));
    const newer = createStream(dict, new Uint8Array([4, 5, 6]));
    const diff = diffStreams(old, newer);
    expect(diff.rawDataChanged).toBe(true);
    expect(diff.dictChanged).toBe(false);
    expect(diff.oldRawLength).toBe(3);
    expect(diff.newRawLength).toBe(3);
  });

  it("detects dict change", () => {
    const dict1 = createDictionary(new Map([["Length", createNumber(3)]]));
    const dict2 = createDictionary(new Map([["Length", createNumber(5)]]));
    const data = new Uint8Array([1, 2, 3]);
    const old = createStream(dict1, data);
    const newer = createStream(dict2, data);
    const diff = diffStreams(old, newer);
    expect(diff.dictChanged).toBe(true);
    expect(diff.rawDataChanged).toBe(false);
  });

  it("handles identical streams", () => {
    const dict = createDictionary(new Map([["Length", createNumber(3)]]));
    const data = new Uint8Array([1, 2, 3]);
    const a = createStream(dict, data);
    const b = createStream(dict, data);
    const diff = diffStreams(a, b);
    expect(diff.dictChanged).toBe(false);
    expect(diff.rawDataChanged).toBe(false);
  });

  it("handles null inputs", () => {
    const dict = createDictionary(new Map());
    const s = createStream(dict, new Uint8Array([1]));
    const diff = diffStreams(null, s);
    expect(diff.rawDataChanged).toBe(true);
    expect(diff.oldRawLength).toBe(0);
    expect(diff.newRawLength).toBe(1);
  });
});
