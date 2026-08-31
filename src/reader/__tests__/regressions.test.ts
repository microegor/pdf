import pako from "pako";
import { describe, expect, it } from "vitest";
import { buildCurrentState, buildHistoryIndex, getObjectAtRevision } from "../history.js";
import {
  bytesToString,
  createArray,
  createCursor,
  createDictionary,
  createNumber,
  createStream,
  DEFAULT_PARSE_LIMITS,
  decodePDFString,
  decodeStream,
  diffStreams,
  equalPDFObject,
  getObject,
  getObjectLifecycle,
  getObjectVersion,
  getObjectVersionDescriptors,
  ObjectValueLimitError,
  parse,
  parseIndirectObject,
  parseObject,
  parseXRefStream,
} from "../index.js";
import type { ObjectHistoryEvent, ObjectVersionLocator, PDFDocument, PDFObject } from "../types.js";
import { parseXRefTable } from "../xref/table.js";
import { buildMultiRevisionPDF, buildSingleRevisionPDF } from "./fixtures.js";

const encoder = new TextEncoder();

function textBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((total, array) => total + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

function buildMalformedPrevXRefStreamPDF(): Uint8Array {
  const header = textBytes("%PDF-1.5\n");
  const xrefOffset = header.length;
  const prefix = textBytes(
    "1 0 obj\n" + "<< /Type /XRef /Size 1 /W [1 1 1] /Length 3 /Prev /Bad >>\n" + "stream\n",
  );
  const suffix = textBytes("\nendstream\nendobj\nstartxref\n");
  const tail = textBytes(`${xrefOffset}\n%%EOF`);
  return concatBytes(header, prefix, new Uint8Array([0, 0, 0]), suffix, tail);
}

function buildSelfIndexedXRefStreamPDF(): Uint8Array {
  const header = textBytes("%PDF-1.5\n");
  const xrefStreamOffset = header.length;
  const prefix = textBytes(
    "1 0 obj\n" + "<< /Type /XRef /Size 2 /W [1 1 1] /Index [0 2] /Length 6 >>\n" + "stream\n",
  );
  const data = new Uint8Array([0, 0, 0xff, 1, xrefStreamOffset, 0]);
  const suffix = textBytes("\nendstream\nendobj\nstartxref\n");
  const tail = textBytes(`${xrefStreamOffset}\n%%EOF`);
  return concatBytes(header, prefix, data, suffix, tail);
}

function buildHybridPDFWithMalformedXRefStm(): Uint8Array {
  const header = "%PDF-1.7\n";
  const body = "1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  const objectOffset = header.length;
  const xrefOffset = header.length + body.length;
  const xref = [
    "xref",
    "0 2",
    "0000000000 65535 f",
    `${String(objectOffset).padStart(10, "0")} 00000 n`,
    "trailer",
    "<< /Size 2 /Root 1 0 R /XRefStm /Bad >>",
    "",
  ].join("\n");
  return textBytes(`${header}${body}${xref}startxref\n${xrefOffset}\n%%EOF`);
}

function buildHybridPDFExceedingObjectLimit(): Uint8Array {
  const header = textBytes("%PDF-1.5\n");
  const object = textBytes("1 0 obj\n<< /Type /Catalog >>\nendobj\n");
  const xrefStreamOffset = header.length + object.length;
  const xrefStreamPrefix = textBytes(
    "20 0 obj\n" + "<< /Type /XRef /Size 3 /W [1 1 1] /Index [0 1 2 1] /Length 6 >>\n" + "stream\n",
  );
  const xrefStreamData = new Uint8Array([0, 0, 0, 1, 0, 0]);
  const xrefStreamSuffix = textBytes("\nendstream\nendobj\n");
  const xrefOffset =
    xrefStreamOffset + xrefStreamPrefix.length + xrefStreamData.length + xrefStreamSuffix.length;
  const classicXRef = textBytes(
    [
      "xref",
      "0 2",
      "0000000000 65535 f",
      `${String(header.length).padStart(10, "0")} 00000 n`,
      "trailer",
      `<< /Size 3 /XRefStm ${xrefStreamOffset} >>`,
      "",
    ].join("\n"),
  );
  const tail = textBytes(`startxref\n${xrefOffset}\n%%EOF`);
  return concatBytes(
    header,
    object,
    xrefStreamPrefix,
    xrefStreamData,
    xrefStreamSuffix,
    classicXRef,
    tail,
  );
}

function createObjectStreamValue(
  options: { includeType?: boolean; data?: string } = {},
): PDFObject {
  const data = textBytes(options.data ?? "42 0 <</Value 1>>");
  const entries = new Map<string, PDFObject>([
    ["N", createNumber(1)],
    ["First", createNumber(5)],
    ["Length", createNumber(data.length)],
  ]);
  if (options.includeType !== false) {
    entries.set("Type", { type: "name", value: "ObjStm" });
  }
  return createStream(createDictionary(entries), data);
}

function buildCompressedMaterializationDocument(
  streamObject: PDFObject | undefined,
  indexInStream = 0,
): PDFDocument {
  return {
    buffer: new Uint8Array(),
    version: "1.7",
    sections: [
      {
        entries: new Map([
          [42, { type: "compressed" as const, objectStreamNumber: 10, indexInStream }],
        ]),
        trailer: createDictionary(new Map()),
        startXRef: 0,
        revisionIndex: 0,
      },
    ],
    objects: streamObject
      ? new Map([
          [
            "10_0",
            {
              objectNumber: 10,
              generation: 0,
              value: streamObject,
              sectionIndex: 0,
              revisionIndex: 0,
            },
          ],
        ])
      : new Map(),
    history: {
      eventsByObject: new Map(),
      versionCache: new Map(),
      complete: true,
      limits: DEFAULT_PARSE_LIMITS,
      materializingKeys: new Set(),
      parsedStreamCache: new Map(),
    },
    complete: true,
    diagnostics: [],
  };
}

function buildHybridPDFWithInvalidSupplementalXRef(): Uint8Array {
  const header = "%PDF-1.7\n";
  const body = "1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  const objectOffset = header.length;
  const xrefOffset = header.length + body.length;
  const xref = [
    "xref",
    "0 2",
    "0000000000 65535 f",
    `${String(objectOffset).padStart(10, "0")} 00000 n`,
    "trailer",
    "<< /Size 2 /Root 1 0 R /XRefStm 999999 >>",
    "",
  ].join("\n");
  return textBytes(`${header}${body}${xref}startxref\n${xrefOffset}\n%%EOF`);
}

function buildCompressedStateDocument(): PDFDocument {
  const makeObjectStream = (value: number): Uint8Array => {
    const data = textBytes(`42 0 <</Value ${value}>>`);
    return textBytes(
      `10 0 obj\n<< /Type /ObjStm /N 1 /First 5 /Length ${data.length} >>\n` +
        `stream\n${new TextDecoder().decode(data)}\nendstream\nendobj\n`,
    );
  };

  const oldObjectStream = makeObjectStream(1);
  const newObjectStream = makeObjectStream(2);
  const buffer = new Uint8Array(oldObjectStream.length + newObjectStream.length);
  buffer.set(oldObjectStream, 0);
  buffer.set(newObjectStream, oldObjectStream.length);

  const oldCompressed: ObjectVersionLocator = {
    kind: "version",
    objectNumber: 42,
    generation: 0,
    sectionIndex: 1,
    revisionIndex: 0,
    entry: { type: "compressed", objectStreamNumber: 10, indexInStream: 0 },
    sourceKey: "old-compressed",
  };
  const newCompressed: ObjectVersionLocator = {
    ...oldCompressed,
    sectionIndex: 0,
    revisionIndex: 1,
    sourceKey: "new-compressed",
  };
  const sections = [
    {
      entries: new Map([
        [10, { type: "used" as const, offset: oldObjectStream.length, generation: 0 }],
        [42, newCompressed.entry],
      ]),
      trailer: createDictionary(new Map()),
      startXRef: 0,
      revisionIndex: 1,
    },
    {
      entries: new Map([
        [10, { type: "used" as const, offset: 0, generation: 0 }],
        [42, oldCompressed.entry],
      ]),
      trailer: createDictionary(new Map()),
      startXRef: 0,
      revisionIndex: 0,
    },
  ];
  const eventsByObject = new Map<number, readonly ObjectHistoryEvent[]>([
    [42, [oldCompressed, newCompressed]],
  ]);

  return {
    buffer,
    version: "1.7",
    sections,
    objects: new Map(),
    history: {
      eventsByObject,
      versionCache: new Map(),
      complete: true,
      limits: DEFAULT_PARSE_LIMITS,
      materializingKeys: new Set(),
      parsedStreamCache: new Map(),
    },
    complete: true,
    diagnostics: [],
  };
}

describe("parser hardening regressions", () => {
  it("enforces maxDepth in nested arrays", () => {
    const cursor = createCursor(new TextEncoder().encode("[[[]]]"));
    expect(() =>
      parseObject(cursor, {
        ...DEFAULT_PARSE_LIMITS,
        maxDepth: 1,
        maxStreamBytes: 1024,
      }),
    ).toThrow(/nesting depth/);
  });

  it("bounds direct values in one indirect object graph", () => {
    const cursor = createCursor(textBytes("[null null null]"));
    expect(() =>
      parseObject(cursor, {
        ...DEFAULT_PARSE_LIMITS,
        maxObjectValues: 3,
      }),
    ).toThrow(ObjectValueLimitError);

    const doc = parse(
      buildSingleRevisionPDF(
        [{ objNum: 1, genNum: 0, content: "[null null null]" }],
        "/Root 1 0 R",
      ),
      { limits: { maxObjectValues: 3 } },
    );
    expect(doc.complete).toBe(false);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      true,
    );
  });

  it("shares the direct-value budget across indirect objects", () => {
    const doc = parse(
      buildSingleRevisionPDF(
        [
          { objNum: 1, genNum: 0, content: "[null null]" },
          { objNum: 2, genNum: 0, content: "[null null]" },
        ],
        "/Root 1 0 R",
      ),
      { limits: { maxObjectValues: 5 } },
    );

    expect(doc.complete).toBe(false);
    expect(doc.history.objectValueBudget?.used).toBe(5);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      true,
    );
  });

  it("stops current-object traversal after one maxObjectValues diagnostic", () => {
    const doc = parse(
      buildSingleRevisionPDF(
        Array.from({ length: 100 }, (_, index) => ({
          objNum: index + 1,
          genNum: 0,
          content: String(index + 1),
        })),
      ),
      { limits: { maxObjectValues: 2 } },
    );

    expect(doc.complete).toBe(false);
    expect(doc.objects.size).toBe(0);
    expect(
      doc.diagnostics.filter((diagnostic) => diagnostic.code === "max-object-values"),
    ).toHaveLength(1);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "object-parse")).toBe(false);
  });

  it("reuses the parsed XRef-stream object without spending its value budget twice", () => {
    const doc = parse(buildSelfIndexedXRefStreamPDF(), {
      limits: { maxObjectValues: 11 },
    });

    expect(doc.complete).toBe(true);
    expect(doc.objects.get("1_0")?.value.type).toBe("stream");
    expect(doc.history.objectValueBudget?.used).toBe(11);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      false,
    );
  });

  it("shares the direct-value budget with XRef trailer parsing", () => {
    const trailerValues = `/Extra [${Array.from({ length: 5 }, () => "null").join(" ")}]`;
    const doc = parse(
      buildMultiRevisionPDF(
        Array.from({ length: 6 }, () => ({
          objects: [{ objNum: 1, genNum: 0, content: "1" }],
          trailer: trailerValues,
        })),
      ),
      { limits: { maxObjectValues: 20 } },
    );

    expect(doc.complete).toBe(false);
    expect(doc.history.objectValueBudget?.used).toBe(20);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      true,
    );
  });

  it("rejects unterminated strings and indirect objects", () => {
    expect(() => parseObject(createCursor(new TextEncoder().encode("(unterminated")))).toThrow(
      /Unterminated/,
    );
    expect(() => parseObject(createCursor(new TextEncoder().encode("<123")))).toThrow(
      /Unterminated/,
    );
    expect(() => parseIndirectObject(createCursor(new TextEncoder().encode("1 0 obj 1")))).toThrow(
      /endobj/,
    );
  });

  it("rejects malformed XRef subsection headers instead of looping", () => {
    const bytes = new TextEncoder().encode("xref\nx\ntrailer\n<< /Size 1 >>");
    expect(() => parseXRefTable(bytes, 0)).toThrow(/subsection/);
  });

  it("applies maxObjects across all classic XRef subsections", () => {
    const bytes = textBytes(
      [
        "xref",
        "0 1",
        "0000000000 65535 f",
        "1 2",
        "0000000010 00000 n",
        "0000000020 00000 n",
        "trailer",
        "<< /Size 3 >>",
      ].join("\n"),
    );
    expect(() => parseXRefTable(bytes, 0, { ...DEFAULT_PARSE_LIMITS, maxObjects: 1 })).toThrow(
      /XRef object entries exceed maximum/,
    );
  });

  it("counts every entry in a nonzero classic XRef subsection against maxObjects", () => {
    const bytes = textBytes(
      ["xref", "5 2", "0000000010 00000 n", "0000000020 00000 n", "trailer", "<< /Size 7 >>"].join(
        "\n",
      ),
    );
    expect(() => parseXRefTable(bytes, 0, { ...DEFAULT_PARSE_LIMITS, maxObjects: 1 })).toThrow(
      /XRef object entries exceed maximum/,
    );
  });

  it("counts repeated object-zero classic subsections only once", () => {
    const bytes = textBytes(
      [
        "xref",
        "0 1",
        "0000000000 65535 f",
        "0 1",
        "0000000000 65535 f",
        "trailer",
        "<< /Size 1 >>",
      ].join("\n"),
    );
    expect(() => parseXRefTable(bytes, 0, { ...DEFAULT_PARSE_LIMITS, maxObjects: 0 })).toThrow(
      /XRef object entries exceed maximum/,
    );
  });

  it("bounds retained XRef entries across incremental revisions", () => {
    const doc = parse(
      buildMultiRevisionPDF([
        { objects: [{ objNum: 1, genNum: 0, content: "1" }], trailer: "/Root 1 0 R" },
        { objects: [{ objNum: 1, genNum: 0, content: "2" }], trailer: "/Root 1 0 R" },
      ]),
      { limits: { maxXRefEntries: 1 } },
    );

    expect(doc.complete).toBe(false);
    expect(doc.history.complete).toBe(false);
    expect(getObjectLifecycle(doc, 1, 0)?.historyComplete).toBe(false);
    expect(doc.sections).toHaveLength(1);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-xref-entries")).toBe(true);
    expect(
      doc.diagnostics.find((diagnostic) => diagnostic.code === "partial-document")?.message,
    ).toMatch(/XRef revision chain/);
  });

  it("marks a document incomplete when supplemental hybrid XRef parsing fails", () => {
    const doc = parse(buildHybridPDFWithInvalidSupplementalXRef());
    expect(doc.complete).toBe(false);
    expect(doc.diagnostics.some((d) => d.code === "malformed-xref-stm")).toBe(true);
  });

  it("enforces maxObjects after merging hybrid XRef entries", () => {
    const doc = parse(buildHybridPDFExceedingObjectLimit(), { limits: { maxObjects: 1 } });
    expect(doc.complete).toBe(false);
    expect(doc.sections[0]?.entries.has(2)).toBe(false);
    expect(doc.diagnostics.some((d) => d.code === "max-objects")).toBe(true);
  });

  it("diagnoses a non-numeric hybrid /XRefStm value", () => {
    const doc = parse(buildHybridPDFWithMalformedXRefStm());
    expect(doc.complete).toBe(false);
    expect(doc.diagnostics.some((d) => d.code === "malformed-xref-stm")).toBe(true);
  });

  it("marks documents incomplete for malformed /Prev in classic tables and XRef streams", () => {
    const tableDoc = parse(
      buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }], "/Prev /Bad"),
    );
    expect(tableDoc.complete).toBe(false);
    expect(tableDoc.diagnostics.some((d) => d.code === "malformed-prev")).toBe(true);

    const streamDoc = parse(buildMalformedPrevXRefStreamPDF());
    expect(streamDoc.complete).toBe(false);
    expect(streamDoc.diagnostics.some((d) => d.code === "malformed-prev")).toBe(true);
  });

  it("recovers as a partial document when /Prev points outside or inside non-XRef data", () => {
    for (const prev of ["/Prev 999999", "/Prev 1"]) {
      const doc = parse(buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }], prev));
      expect(doc.complete).toBe(false);
      expect(getObject(doc, 1)).toEqual({ type: "number", value: 1 });
      expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "invalid-prev")).toBe(true);
    }
  });

  it("rejects non-numeric XRef stream field widths", () => {
    const bytes = textBytes(
      "1 0 obj\n" +
        "<< /Type /XRef /Size 1 /W [1 /Bad 1] /Length 3 >>\n" +
        "stream\n" +
        "\0\0\0\n" +
        "endstream\n" +
        "endobj\n",
    );
    expect(() => parseXRefStream(bytes, 0)).toThrow(/Invalid W/);
  });

  it("rejects XRef stream fields that exceed JavaScript safe integer precision", () => {
    const bytes = concatBytes(
      textBytes("1 0 obj\n" + "<< /Type /XRef /Size 1 /W [0 7 0] /Length 7 >>\n" + "stream\n"),
      new Uint8Array(7).fill(0xff),
      textBytes("\nendstream\nendobj\n"),
    );
    expect(() => parseXRefStream(bytes, 0)).toThrow(/safe integer/);
  });

  it("rejects object and generation identifiers outside PDF safe ranges", () => {
    expect(() => parseObject(createCursor(textBytes("9007199254740993 0 R")))).toThrow(
      /Invalid PDF reference/,
    );
    expect(() => parseObject(createCursor(textBytes("-1 0 R")))).toThrow(/Invalid PDF reference/);
    expect(() =>
      parseIndirectObject(createCursor(textBytes("9007199254740993 0 obj 1 endobj"))),
    ).toThrow(/object number/);
    expect(() => parseIndirectObject(createCursor(textBytes("-1 0 obj 1 endobj")))).toThrow(
      /object number/,
    );
    expect(() => parseIndirectObject(createCursor(textBytes("1 65536 obj 1 endobj")))).toThrow(
      /generation number/,
    );

    expect(() =>
      parseXRefTable(
        textBytes(["xref", "0 1", "0000000000 99999 f", "trailer", "<< /Size 1 >>"].join("\n")),
      ),
    ).toThrow(/XRef generation/);

    const xrefStreamWithInvalidGeneration = concatBytes(
      textBytes("1 0 obj\n" + "<< /Type /XRef /Size 1 /W [1 1 3] /Length 5 >>\n" + "stream\n"),
      new Uint8Array([1, 0, 1, 0, 0]),
      textBytes("\nendstream\nendobj\n"),
    );
    expect(() => parseXRefStream(xrefStreamWithInvalidGeneration)).toThrow(/XRef generation/);
  });

  it("rejects malformed XRef stream Index types instead of using the default range", () => {
    const bytes = concatBytes(
      textBytes(
        "1 0 obj\n" + "<< /Type /XRef /Size 1 /W [1 1 1] /Index /Bad /Length 3 >>\n" + "stream\n",
      ),
      new Uint8Array(3),
      textBytes("\nendstream\nendobj\n"),
    );
    expect(() => parseXRefStream(bytes, 0)).toThrow(/Invalid Index/);
  });

  it("bounds literal and hex string sizes before decoding", () => {
    expect(() =>
      parseObject(createCursor(textBytes("(abcdef)")), {
        ...DEFAULT_PARSE_LIMITS,
        maxStringBytes: 5,
      }),
    ).toThrow(/PDF string size/);
    expect(() =>
      parseObject(createCursor(textBytes("<000102>")), {
        ...DEFAULT_PARSE_LIMITS,
        maxStringBytes: 5,
      }),
    ).toThrow(/PDF string size/);
  });

  it("rejects non-hex, non-whitespace bytes in hex strings", () => {
    expect(() => parseObject(createCursor(textBytes("<4G1>")))).toThrow(/Invalid hex string byte/);
    expect(() => parseObject(createCursor(textBytes("<GG>")))).toThrow(/Invalid hex string byte/);

    const valid = parseObject(createCursor(textBytes("<4\0\t\n\f\r 1>")));
    expect(valid).toEqual({ type: "hexstring", raw: new Uint8Array([0x41]) });
  });

  it("bounds PDF names before decoding escaped bytes", () => {
    expect(() =>
      parseObject(createCursor(textBytes("/#41aaaa")), {
        ...DEFAULT_PARSE_LIMITS,
        maxStringBytes: 5,
      }),
    ).toThrow(/PDF name size/);
  });

  it("counts nonzero XRef stream ranges against maxObjects", () => {
    const bytes = concatBytes(
      textBytes(
        "1 0 obj\n" + "<< /Type /XRef /Size 7 /W [1 1 1] /Index [5 2] /Length 6 >>\n" + "stream\n",
      ),
      new Uint8Array(6),
      textBytes("\nendstream\nendobj\n"),
    );
    expect(() => parseXRefStream(bytes, 0, { ...DEFAULT_PARSE_LIMITS, maxObjects: 1 })).toThrow(
      /XRef stream object entries exceed maximum/,
    );
  });

  it("counts repeated object-zero XRef stream ranges only once", () => {
    const bytes = concatBytes(
      textBytes(
        "1 0 obj\n" +
          "<< /Type /XRef /Size 1 /W [1 1 1] /Index [0 1 0 1] /Length 6 >>\n" +
          "stream\n",
      ),
      new Uint8Array(6),
      textBytes("\nendstream\nendobj\n"),
    );
    expect(() => parseXRefStream(bytes, 0, { ...DEFAULT_PARSE_LIMITS, maxObjects: 0 })).toThrow(
      /XRef stream object entries exceed maximum/,
    );
  });

  it("marks history and document incomplete when history limits truncate indexing", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }], trailer: "/Root 1 0 R" },
    ]);
    const doc = parse(pdf, { limits: { maxObjectVersions: 1 } });
    expect(doc.complete).toBe(false);
    expect(doc.history.complete).toBe(false);
    expect(doc.diagnostics.some((d) => d.code === "incomplete-history")).toBe(true);
  });

  it("still builds current state when history indexing is truncated", () => {
    const doc = parse(buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }]), {
      limits: { maxObjectVersions: 0 },
    });
    expect(doc.complete).toBe(false);
    expect(getObject(doc, 1)).toEqual({ type: "number", value: 1 });
  });

  it("marks the document incomplete when object materialization hits maxObjects", () => {
    const doc = parse(
      buildSingleRevisionPDF([
        { objNum: 1, genNum: 0, content: "1" },
        { objNum: 2, genNum: 0, content: "2" },
      ]),
    );
    doc.objects.clear();
    const complete = buildCurrentState(doc, { ...DEFAULT_PARSE_LIMITS, maxObjects: 1 });
    expect(complete).toBe(false);
    expect(doc.diagnostics.some((d) => d.code === "max-objects")).toBe(true);
  });

  it("reports materialization diagnostics through onDiagnostic", () => {
    const reportedCodes: string[] = [];
    const doc = parse(buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "(" }]), {
      limits: { maxObjects: 1 },
      onDiagnostic: (diagnostic) => reportedCodes.push(diagnostic.code),
    });

    expect(doc.complete).toBe(false);
    expect(reportedCodes).toContain("object-parse");
    expect(reportedCodes).toContain("partial-document");
  });

  it("reports specific failures when compressed objects cannot be materialized", () => {
    const cases: Array<{ code: string; streamObject: PDFObject | undefined; index?: number }> = [
      { code: "object-stream-missing", streamObject: undefined },
      { code: "object-stream-type", streamObject: createNumber(1) },
      { code: "object-stream-type", streamObject: createObjectStreamValue({ includeType: false }) },
      { code: "object-stream-index", streamObject: createObjectStreamValue(), index: 1 },
    ];

    for (const { code, streamObject, index } of cases) {
      const doc = buildCompressedMaterializationDocument(streamObject, index);
      expect(buildCurrentState(doc, DEFAULT_PARSE_LIMITS)).toBe(false);
      expect(doc.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
    }
  });

  it("uses the latest compressed history event and counts object streams once", () => {
    const doc = buildCompressedStateDocument();
    const complete = buildCurrentState(doc, { ...DEFAULT_PARSE_LIMITS, maxObjects: 2 });

    expect(complete).toBe(true);
    expect(doc.objects.size).toBe(2);
    expect(doc.objects.get("42_0")?.revisionIndex).toBe(1);
  });

  it("reuses eagerly materialized current versions from the history cache", () => {
    const doc = parse(buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "[null null]" }]), {
      limits: { maxObjectValues: 5 },
    });
    const usedBeforeLookup = doc.history.objectValueBudget?.used;

    expect(doc.complete).toBe(true);
    expect(getObjectVersion(doc, 1, 0, 0)?.value).toMatchObject({ type: "array" });
    expect(doc.history.objectValueBudget?.used).toBe(usedBeforeLookup);
    expect(doc.complete).toBe(true);
    expect(doc.history.versionCache.has("1_0@0")).toBe(true);
  });

  it("shares the direct-value budget with embedded object-stream values", () => {
    const doc = buildCompressedStateDocument();
    const complete = buildCurrentState(doc, {
      ...DEFAULT_PARSE_LIMITS,
      maxObjects: 2,
      maxObjectValues: 6,
    });

    expect(complete).toBe(false);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      true,
    );
  });

  it("creates an implicit history event when an object stream is rewritten", () => {
    const doc = buildCompressedStateDocument();
    doc.sections[0]?.entries.delete(42);
    doc.history = buildHistoryIndex(doc, DEFAULT_PARSE_LIMITS);

    expect(doc.history.eventsByObject.get(42)?.map((event) => event.revisionIndex)).toEqual([0, 1]);
    expect(buildCurrentState(doc, DEFAULT_PARSE_LIMITS)).toBe(true);
    expect(doc.objects.get("42_0")?.revisionIndex).toBe(1);

    const oldVersion = getObjectAtRevision(doc, 42, 0, 0);
    const currentVersion = getObjectAtRevision(doc, 42, 0, 1);
    expect(oldVersion?.value).toMatchObject({ type: "dictionary" });
    expect(currentVersion?.value).toMatchObject({ type: "dictionary" });
    if (oldVersion?.value.type === "dictionary" && currentVersion?.value.type === "dictionary") {
      expect(oldVersion.value.entries.get("Value")).toEqual({ type: "number", value: 1 });
      expect(currentVersion.value.entries.get("Value")).toEqual({ type: "number", value: 2 });
    }
  });

  it("keeps the compressed-object reverse index across ordinary revisions", () => {
    const doc = buildCompressedStateDocument();
    const rewrittenStreamSection = doc.sections[0];
    const originalSection = doc.sections[1];
    if (!rewrittenStreamSection || !originalSection) throw new Error("Missing fixture sections");
    rewrittenStreamSection.entries.delete(42);

    const ordinarySections = Array.from({ length: 32 }, (_, index) => ({
      entries: new Map([[100 + index, { type: "used" as const, offset: 0, generation: 0 }]]),
      trailer: createDictionary(new Map()),
      startXRef: 0,
    }));
    doc.sections = [...ordinarySections.reverse(), rewrittenStreamSection, originalSection];
    doc.history = buildHistoryIndex(doc, DEFAULT_PARSE_LIMITS);

    expect(doc.history.eventsByObject.get(42)?.map((event) => event.revisionIndex)).toEqual([0, 1]);
  });

  it("keeps lazy history stable when the caller mutates its input buffer", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }] },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }] },
    ]);
    const doc = parse(pdf);
    const marker = new TextEncoder().encode("/Value 1");
    for (let i = 0; i <= pdf.length - marker.length; i++) {
      let matches = true;
      for (let j = 0; j < marker.length; j++) if (pdf[i + j] !== marker[j]) matches = false;
      if (matches) pdf[i + marker.length - 1] = 0x39;
    }
    const version = getObjectVersion(doc, 1, 0, 0);
    expect(version?.value.type).toBe("dictionary");
    if (version?.value.type === "dictionary") {
      expect(version.value.entries.get("Value")).toEqual({ type: "number", value: 1 });
    }
  });

  it("shares the direct-value budget with lazy history materialization", () => {
    const doc = parse(
      buildMultiRevisionPDF([
        { objects: [{ objNum: 1, genNum: 0, content: "[null null]" }] },
        { objects: [{ objNum: 1, genNum: 0, content: "1" }] },
      ]),
      { limits: { maxObjectValues: 7 } },
    );

    expect(doc.complete).toBe(true);
    expect(() => getObjectVersion(doc, 1, 0, 0)).toThrow(/Maximum PDF object values/);
    expect(doc.complete).toBe(false);
    expect(doc.history.complete).toBe(false);
    expect(doc.diagnostics.some((diagnostic) => diagnostic.code === "max-object-values")).toBe(
      true,
    );
  });

  it("returns null for a generation that was never written", () => {
    const doc = parse(buildSingleRevisionPDF([{ objNum: 1, genNum: 0, content: "1" }]));
    expect(getObjectLifecycle(doc, 1, 9)).toBeNull();
  });
});

describe("binary and diff regressions", () => {
  it("decodes PDFDocEncoding euro and undefined bytes according to the PDF table", () => {
    expect(decodePDFString(new Uint8Array([0x9f]))).toBe("\ufffd");
    expect(decodePDFString(new Uint8Array([0xa0]))).toBe("\u20ac");
  });

  it("decodes large UTF-16BE strings without exceeding the call-stack argument limit", () => {
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

  it("decodes TIFF Predictor 2 with bytes per pixel", () => {
    const compressed = pako.deflate(new Uint8Array([10, 10, 10]));
    const decodeParms = createDictionary(
      new Map([
        ["Predictor", createNumber(2)],
        ["Columns", createNumber(3)],
        ["Colors", createNumber(1)],
        ["BitsPerComponent", createNumber(8)],
      ]),
    );
    const dictionary = createDictionary(
      new Map([
        ["Length", createNumber(compressed.length)],
        ["Filter", { type: "name" as const, value: "FlateDecode" }],
        ["DecodeParms", decodeParms],
      ]),
    );
    const result = decodeStream(createStream(dictionary, compressed), DEFAULT_PARSE_LIMITS);
    expect(Array.from(result)).toEqual([10, 20, 30]);
  });

  it("decodes TIFF Predictor 2 for 16-bit and packed samples", () => {
    const decode = (encoded: Uint8Array, bitsPerComponent: number, columns: number): Uint8Array => {
      const compressed = pako.deflate(encoded);
      const decodeParms = createDictionary(
        new Map([
          ["Predictor", createNumber(2)],
          ["Columns", createNumber(columns)],
          ["Colors", createNumber(1)],
          ["BitsPerComponent", createNumber(bitsPerComponent)],
        ]),
      );
      const dictionary = createDictionary(
        new Map([
          ["Length", createNumber(compressed.length)],
          ["Filter", { type: "name" as const, value: "FlateDecode" }],
          ["DecodeParms", decodeParms],
        ]),
      );
      return decodeStream(createStream(dictionary, compressed), DEFAULT_PARSE_LIMITS);
    };

    expect(Array.from(decode(new Uint8Array([0, 255, 0, 1]), 16, 2))).toEqual([0, 255, 1, 0]);
    expect(Array.from(decode(new Uint8Array([0xa0]), 1, 3))).toEqual([0xc0]);
    expect(Array.from(decode(new Uint8Array([0x6c]), 2, 3))).toEqual([0x78]);
    expect(Array.from(decode(new Uint8Array([0xa9, 0x40]), 4, 3))).toEqual([0xa3, 0x70]);
  });

  it("keeps every byte in bytesToString", () => {
    expect(bytesToString(new Uint8Array([0x80, 0x9f]))).toBe("\u0080\u009f");
  });

  it("keeps equality reflexive for cyclic self-objects", () => {
    const value = createArray([]);
    value.items.push(value);
    expect(equalPDFObject(value, value)).toBe(true);
  });

  it("compares independent cyclic and deeply nested structures semantically", () => {
    const firstCycle = createArray([]);
    const secondCycle = createArray([]);
    firstCycle.items.push(firstCycle);
    secondCycle.items.push(secondCycle);
    expect(equalPDFObject(firstCycle, secondCycle)).toBe(true);

    const firstDeep = createArray([]);
    const secondDeep = createArray([]);
    let firstCursor = firstDeep;
    let secondCursor = secondDeep;
    for (let i = 0; i < 60; i++) {
      const nextFirst = createArray([]);
      const nextSecond = createArray([]);
      firstCursor.items.push(nextFirst);
      secondCursor.items.push(nextSecond);
      firstCursor = nextFirst;
      secondCursor = nextSecond;
    }
    expect(equalPDFObject(firstDeep, secondDeep)).toBe(true);
  });

  it("compares decoded bytes for unfiltered streams", () => {
    const dict = createDictionary(new Map([["Length", createNumber(2)]]));
    const diff = diffStreams(
      createStream(dict, new Uint8Array([1, 2])),
      createStream(dict, new Uint8Array([1, 3])),
    );
    expect(diff.decodedCompared).toBe(true);
    expect(diff.decodedChanged).toBe(true);
  });

  it("enforces decoded-size limits while ASCII filters accumulate output", () => {
    const ascii85Dictionary = createDictionary(
      new Map([
        ["Length", createNumber(1)],
        ["Filter", { type: "name" as const, value: "ASCII85Decode" }],
      ]),
    );
    expect(() =>
      decodeStream(createStream(ascii85Dictionary, new Uint8Array([0x7a])), {
        ...DEFAULT_PARSE_LIMITS,
        maxDecodedStreamBytes: 1,
      }),
    ).toThrow(/ASCII85Decode output/);

    const asciiHexDictionary = createDictionary(
      new Map([
        ["Length", createNumber(2)],
        ["Filter", { type: "name" as const, value: "ASCIIHexDecode" }],
      ]),
    );
    expect(() =>
      decodeStream(createStream(asciiHexDictionary, new Uint8Array([0x30, 0x30])), {
        ...DEFAULT_PARSE_LIMITS,
        maxDecodedStreamBytes: 0,
      }),
    ).toThrow(/ASCIIHexDecode output/);

    const chunkedASCII85 = decodeStream(
      createStream(ascii85Dictionary, new Uint8Array(16_384).fill(0x7a)),
      {
        ...DEFAULT_PARSE_LIMITS,
        maxDecodedStreamBytes: 64 * 1024,
      },
    );
    expect(chunkedASCII85.length).toBe(64 * 1024);
    expect(chunkedASCII85.every((byte) => byte === 0)).toBe(true);
  });

  it("rejects malformed ASCII85 end markers and overflowing tuples", () => {
    const decodeASCII85 = (value: string): Uint8Array => {
      const data = textBytes(value);
      const dictionary = createDictionary(
        new Map([
          ["Length", createNumber(data.length)],
          ["Filter", { type: "name" as const, value: "ASCII85Decode" }],
        ]),
      );
      return decodeStream(createStream(dictionary, data), DEFAULT_PARSE_LIMITS);
    };

    expect(() => decodeASCII85("!!!!!~")).toThrow(/ASCII85 end marker/);
    expect(() => decodeASCII85("!!!!!~x")).toThrow(/ASCII85 end marker/);
    expect(() => decodeASCII85("uuuuu~>")).toThrow(/ASCII85 tuple exceeds/);
    expect(Array.from(decodeASCII85("!!!!!~>"))).toEqual([0, 0, 0, 0]);
  });

  it("bounds Flate output before returning a decoded buffer", () => {
    const dictionary = createDictionary(
      new Map([
        ["Length", createNumber(1)],
        ["Filter", { type: "name" as const, value: "FlateDecode" }],
      ]),
    );
    const stream = createStream(dictionary, pako.deflate(new Uint8Array(128).fill(7)));
    expect(() =>
      decodeStream(stream, { ...DEFAULT_PARSE_LIMITS, maxDecodedStreamBytes: 32 }),
    ).toThrow(/Decoded stream size/);
  });

  it("uses direct history event locators", () => {
    const doc = parse(
      buildMultiRevisionPDF([
        { objects: [{ objNum: 1, genNum: 0, content: "1" }], trailer: "/Root 1 0 R" },
        { objects: [{ objNum: 1, genNum: 0, content: "2" }], trailer: "/Root 1 0 R" },
      ]),
    );
    expect(
      getObjectVersionDescriptors(doc, 1, 0).every((d) => Number.isInteger(d.eventIndex)),
    ).toBe(true);
    expect(getObjectVersion(doc, 1, 0, 1)?.value).toEqual({ type: "number", value: 2 });
  });
});
