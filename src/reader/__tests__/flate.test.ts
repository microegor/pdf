import * as pakoModule from "pako";
import { describe, expect, it } from "vitest";
import { inflate } from "../xref/flate.js";

const pako: any = (pakoModule as any).default ?? pakoModule;

describe("inflate", () => {
  it("inflates valid data", () => {
    const raw = new Uint8Array([1, 2, 3, 4]);
    const compressed = pako.deflate(raw);
    expect(Array.from(inflate(compressed))).toEqual([1, 2, 3, 4]);
  });
  it("throws on invalid maxOutputBytes", () => {
    expect(() => inflate(new Uint8Array([1]), -1)).toThrow(/Invalid maximum/);
  });
  it("handles Infinity maxOutputBytes (special path)", () => {
    const raw = new Uint8Array([5, 6]);
    const compressed = pako.deflate(raw);
    expect(Array.from(inflate(compressed, Infinity))).toEqual([5, 6]);
  });
  it("throws when decompressed exceeds limit", () => {
    const raw = new Uint8Array(128).fill(7);
    const compressed = pako.deflate(raw);
    expect(() => inflate(compressed, 32)).toThrow(/Decoded stream size/);
  });
  it("throws on invalid compressed data", () => {
    expect(() => inflate(new Uint8Array([1, 2, 3]), 1000)).toThrow(/Failed to inflate/);
  });
});
