import { describe, expect, it } from "vitest";
import { createCursor } from "../buffer.js";
import { expectKeyword, expectToken, nextToken, peekToken } from "../tokenizer.js";

describe("tokenizer extended", () => {
  it("expectToken succeeds and throws", () => {
    const c1 = createCursor(new TextEncoder().encode("123"));
    expect(expectToken(c1, "number").value).toBe(123);
    const c2 = createCursor(new TextEncoder().encode("true"));
    expect(() => expectToken(c2, "number")).toThrow(/Expected token type/);
  });
  it("expectKeyword succeeds and throws", () => {
    const c1 = createCursor(new TextEncoder().encode("true"));
    expect(expectKeyword(c1, "true").value).toBe("true");
    const c2 = createCursor(new TextEncoder().encode("false"));
    expect(() => expectKeyword(c2, "true")).toThrow(/Expected keyword/);
  });
  it("throws on unterminated hex string", () => {
    const c = createCursor(new TextEncoder().encode("<ABC"));
    expect(() => nextToken(c)).toThrow(/Unterminated hex string/);
  });
  it("throws on unterminated literal string", () => {
    const c = createCursor(new TextEncoder().encode("(hello"));
    expect(() => nextToken(c)).toThrow(/Unterminated literal string/);
  });
  it("throws on invalid number token standalone dot", () => {
    const c = createCursor(new TextEncoder().encode("."));
    expect(() => nextToken(c)).toThrow(/Invalid number token/);
  });
  it("handles hex string with whitespace and newlines", () => {
    const c = createCursor(new TextEncoder().encode("<41 42>"));
    const t = nextToken(c);
    expect(t?.type).toBe("hexstring");
  });
  it("readName with # hex escapes", () => {
    const c = createCursor(new TextEncoder().encode("/A#42C"));
    const t = nextToken(c);
    expect(t?.type).toBe("name");
    expect(t?.value).toBe("ABC");
  });
  it("throws when name exceeds maxNameBytes", () => {
    const c = createCursor(new TextEncoder().encode("/VeryLongName"));
    expect(() => nextToken(c, 5)).toThrow(/PDF name size/);
  });
  it("keyword boundary check prevents partial match", () => {
    const c = createCursor(new TextEncoder().encode("trueX"));
    const t = nextToken(c);
    // "trueX" should not be tokenized as "true" keyword
    expect(t?.type).toBe("keyword");
    expect(t?.value).toBe("trueX");
  });
  it("peekToken does not advance", () => {
    const c = createCursor(new TextEncoder().encode("123 456"));
    const p = peekToken(c);
    expect(p?.value).toBe(123);
    expect(c.position).toBe(0);
    expect(nextToken(c)?.value).toBe(123);
  });
  it("tokenizes known keywords xref, trailer, startxref, obj, endobj, stream, endstream, R, n, f", () => {
    for (const kw of [
      "xref",
      "trailer",
      "startxref",
      "obj",
      "endobj",
      "stream",
      "endstream",
      "R",
      "n",
      "f",
    ]) {
      const c = createCursor(new TextEncoder().encode(kw));
      expect(nextToken(c)?.value).toBe(kw);
    }
  });
});
