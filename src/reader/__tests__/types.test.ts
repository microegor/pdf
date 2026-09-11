import { describe, expect, it } from "vitest";
import {
  createArray,
  createBoolean,
  createDictionary,
  createHexString,
  createName,
  createNull,
  createNumber,
  createObjectParseBudget,
  createReference,
  createStream,
  createString,
  isArray,
  isBoolean,
  isDictionary,
  isHexString,
  isName,
  isNull,
  isNumber,
  isReference,
  isStream,
  isString,
  objectKey,
  objectVersionKey,
  ObjectVersionParseError,
} from "../types.js";

describe("types helpers", () => {
  it("objectKey and objectVersionKey", () => {
    expect(objectKey(1, 0)).toBe("1_0");
    expect(objectVersionKey(1, 0, 2)).toBe("1_0@2");
  });
  it("createObjectParseBudget", () => {
    const b = createObjectParseBudget(10);
    expect(b.limit).toBe(10);
    expect(b.used).toBe(0);
  });
  it("factories create correct shapes", () => {
    expect(createNull()).toEqual({ type: "null" });
    expect(createBoolean(true)).toEqual({ type: "boolean", value: true });
    expect(createNumber(42)).toEqual({ type: "number", value: 42 });
    expect(createName("Foo")).toEqual({ type: "name", value: "Foo" });
    expect(createArray([]).type).toBe("array");
    expect(createDictionary().entries.size).toBe(0);
    const raw = new Uint8Array([1]);
    expect(createString(raw).raw).toBe(raw);
    expect(createHexString(raw).raw).toBe(raw);
    expect(createReference(1, 0)).toEqual({ type: "reference", objectNumber: 1, generation: 0 });
    const dict = createDictionary();
    expect(createStream(dict, raw).data).toBe(raw);
  });
  it("type guards", () => {
    expect(isNull(createNull())).toBe(true);
    expect(isNull(createNumber(1))).toBe(false);
    expect(isBoolean(createBoolean(true))).toBe(true);
    expect(isNumber(createNumber(1))).toBe(true);
    expect(isString(createString(new Uint8Array()))).toBe(true);
    expect(isHexString(createHexString(new Uint8Array()))).toBe(true);
    expect(isName(createName("a"))).toBe(true);
    expect(isArray(createArray([]))).toBe(true);
    expect(isDictionary(createDictionary())).toBe(true);
    expect(isStream(createStream(createDictionary(), new Uint8Array()))).toBe(true);
    expect(isReference(createReference(1, 0))).toBe(true);
    // negative cases
    expect(isArray(createNull() as any)).toBe(false);
    expect(isDictionary(createNull() as any)).toBe(false);
  });
  it("ObjectVersionParseError message", () => {
    const desc = {
      objectNumber: 1,
      generation: 0,
      versionIndex: 2,
      eventIndex: 2,
      sectionIndex: 0,
      revisionIndex: 1,
    };
    const err = new ObjectVersionParseError(desc, new Error("boom"));
    expect(err.name).toBe("ObjectVersionParseError");
    expect(err.message).toContain("1 0");
    expect(err.message).toContain("boom");
    expect(err.descriptor).toBe(desc);
  });
});
