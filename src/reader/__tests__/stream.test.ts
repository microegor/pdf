import * as pakoModule from "pako";
import { describe, expect, it } from "vitest";

import { createDictionary, createNumber, createStream, DEFAULT_PARSE_LIMITS } from "../types.js";

import { decodeStream } from "../stream.js";

const pako: any = (pakoModule as any).default ?? pakoModule;

describe("decodeStream", () => {
  it("returns raw data when no filter", () => {
    const dict = createDictionary(new Map<string, any>([["Length", createNumber(3)]]));

    const data = new Uint8Array([1, 2, 3]);

    expect(decodeStream(createStream(dict, data))).toEqual(data);
  });

  it("throws when raw size exceeds maxStreamBytes", () => {
    const dict = createDictionary(new Map<string, any>());

    const data = new Uint8Array([1, 2, 3]);

    expect(() =>
      decodeStream(createStream(dict, data), {
        ...DEFAULT_PARSE_LIMITS,
        maxStreamBytes: 2,
      }),
    ).toThrow(/raw size/);
  });

  it("throws when decoded size exceeds limit without filter", () => {
    const dict = createDictionary(new Map<string, any>());

    const data = new Uint8Array([1, 2]);

    expect(() =>
      decodeStream(createStream(dict, data), {
        ...DEFAULT_PARSE_LIMITS,
        maxDecodedStreamBytes: 1,
      }),
    ).toThrow(/Decoded stream size/);
  });

  it("decodes FlateDecode", () => {
    const raw = new Uint8Array([10, 20, 30]);
    const compressed = pako.deflate(raw);

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(compressed.length)],
        [
          "Filter",
          {
            type: "name",
            value: "FlateDecode",
          },
        ],
      ]),
    );

    expect(Array.from(decodeStream(createStream(dict, compressed)))).toEqual([10, 20, 30]);
  });

  it("decodes FlateDecode via array Filter", () => {
    const raw = new Uint8Array([1, 2, 3]);
    const compressed = pako.deflate(raw);

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(compressed.length)],
        [
          "Filter",
          {
            type: "array",
            items: [
              {
                type: "name",
                value: "FlateDecode",
              },
            ],
          },
        ],
      ]),
    );

    expect(Array.from(decodeStream(createStream(dict, compressed)))).toEqual([1, 2, 3]);
  });

  it("decodes FlateDecode with TIFF predictor 2", () => {
    const compressed = pako.deflate(new Uint8Array([10, 10, 10]));

    const parms = createDictionary(
      new Map<string, any>([
        ["Predictor", createNumber(2)],
        ["Columns", createNumber(3)],
        ["Colors", createNumber(1)],
        ["BitsPerComponent", createNumber(8)],
      ]),
    );

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(compressed.length)],
        [
          "Filter",
          {
            type: "name",
            value: "FlateDecode",
          },
        ],
        ["DecodeParms", parms],
      ]),
    );

    expect(Array.from(decodeStream(createStream(dict, compressed)))).toEqual([10, 20, 30]);
  });

  it("decodes FlateDecode with PNG predictor", () => {
    const compressed = pako.deflate(new Uint8Array([1, 2, 3]));

    const parms = createDictionary(
      new Map<string, any>([
        ["Predictor", createNumber(10)],
        ["Columns", createNumber(1)],
      ]),
    );

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(compressed.length)],
        [
          "Filter",
          {
            type: "name",
            value: "FlateDecode",
          },
        ],
        ["DecodeParms", parms],
      ]),
    );

    expect(() => decodeStream(createStream(dict, compressed))).toThrow(/PNG predictor/);
  });

  it("decodes ASCIIHexDecode", () => {
    const data = new TextEncoder().encode("4142>");

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(data.length)],
        [
          "Filter",
          {
            type: "name",
            value: "ASCIIHexDecode",
          },
        ],
      ]),
    );

    expect(new TextDecoder().decode(decodeStream(createStream(dict, data)))).toBe("AB");
  });

  it("decodes ASCII85Decode with z", () => {
    const data = new TextEncoder().encode("z~>");

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(data.length)],
        [
          "Filter",
          {
            type: "name",
            value: "ASCII85Decode",
          },
        ],
      ]),
    );

    expect(Array.from(decodeStream(createStream(dict, data)))).toEqual([0, 0, 0, 0]);
  });

  it("throws on unsupported filter", () => {
    const data = new Uint8Array([1]);

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(data.length)],
        [
          "Filter",
          {
            type: "name",
            value: "LZWDecode",
          },
        ],
      ]),
    );

    expect(() => decodeStream(createStream(dict, data))).toThrow(/Unsupported stream filter/);
  });

  it("throws on invalid Filter type", () => {
    const data = new Uint8Array([1]);

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(data.length)],
        [
          "Filter",
          {
            type: "number",
            value: 1,
          },
        ],
      ]),
    );

    expect(() => decodeStream(createStream(dict, data))).toThrow(/Stream \/Filter/);
  });

  it("enforces maxDecodedStreamBytes after filter", () => {
    const compressed = pako.deflate(new Uint8Array(128).fill(7));

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(compressed.length)],
        [
          "Filter",
          {
            type: "name",
            value: "FlateDecode",
          },
        ],
      ]),
    );

    expect(() =>
      decodeStream(createStream(dict, compressed), {
        ...DEFAULT_PARSE_LIMITS,
        maxDecodedStreamBytes: 32,
      }),
    ).toThrow(/Decoded stream size/);
  });

  it("getDecodeParms array handling", () => {
    const raw = new Uint8Array([1, 2, 3]);

    const c1 = pako.deflate(raw);
    const c2 = pako.deflate(c1);

    const dict = createDictionary(
      new Map<string, any>([
        ["Length", createNumber(c2.length)],
        [
          "Filter",
          {
            type: "array",
            items: [
              {
                type: "name",
                value: "FlateDecode",
              },
              {
                type: "name",
                value: "FlateDecode",
              },
            ],
          },
        ],
      ]),
    );

    const result = decodeStream(createStream(dict, c2));

    expect(Array.from(result)).toEqual([1, 2, 3]);
  });
});
