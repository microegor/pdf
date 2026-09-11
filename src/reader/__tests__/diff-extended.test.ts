import { describe, expect, it } from "vitest";
import { diffArrays, equalPDFObject } from "../diff.js";
import { createArray, createDictionary, createNumber, createString } from "../types.js";

describe("diffArrays", () => {
  it("detects added and removed", () => {
    const old = createArray([createNumber(1)]);
    const newer = createArray([createNumber(1), createNumber(2)]);
    const diff = diffArrays(old, newer);
    expect(diff.addedCount).toBe(1);
    expect(diff.entries.find((e) => e.index === 1)?.kind).toBe("added");
  });
  it("detects removed", () => {
    const old = createArray([createNumber(1), createNumber(2)]);
    const newer = createArray([createNumber(1)]);
    const diff = diffArrays(old, newer);
    expect(diff.removedCount).toBe(1);
  });
  it("detects changed", () => {
    const old = createArray([createNumber(1)]);
    const newer = createArray([createNumber(2)]);
    const diff = diffArrays(old, newer);
    expect(diff.changedCount).toBe(1);
  });
  it("detects unchanged", () => {
    const old = createArray([createNumber(1)]);
    const newer = createArray([createNumber(1)]);
    const diff = diffArrays(old, newer);
    expect(diff.unchangedCount).toBe(1);
  });
  it("handles null inputs", () => {
    const arr = createArray([createNumber(1)]);
    expect(diffArrays(null, arr).addedCount).toBe(1);
    expect(diffArrays(arr, null).removedCount).toBe(1);
    expect(diffArrays(null, null).entries.length).toBe(0);
  });
});

describe("equalPDFObject edge cases", () => {
  it("hexstring equality", () => {
    const a = { type: "hexstring" as const, raw: new Uint8Array([1, 2]) };
    const b = { type: "hexstring" as const, raw: new Uint8Array([1, 2]) };
    const c = { type: "hexstring" as const, raw: new Uint8Array([2, 1]) };
    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
  });
  it("string raw comparison", () => {
    const a = createString(new Uint8Array([1]));
    const b = createString(new Uint8Array([1]));
    const c = createString(new Uint8Array([2]));
    expect(equalPDFObject(a, b)).toBe(true);
    expect(equalPDFObject(a, c)).toBe(false);
  });
  it("different types not equal", () => {
    expect(equalPDFObject(createNumber(1), createString(new Uint8Array([1])))).toBe(false);
  });
  it("depth limit returns false beyond maxDepth", () => {
    let deep: any = createNumber(1);
    for (let i = 0; i < 105; i++) deep = createArray([deep]);
    let deep2: any = createNumber(2);
    for (let i = 0; i < 105; i++) deep2 = createArray([deep2]);
    expect(equalPDFObject(deep, deep2)).toBe(false);
  });
  it("dictionary size mismatch", () => {
    const a = createDictionary(new Map([["A", createNumber(1)]]));
    const b = createDictionary(
      new Map([
        ["A", createNumber(1)],
        ["B", createNumber(2)],
      ]),
    );
    expect(equalPDFObject(a, b)).toBe(false);
  });
});
