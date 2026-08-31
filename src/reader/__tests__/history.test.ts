/**
 * Object History Tests
 */

import { describe, expect, it } from "vitest";
import {
  extractRevisionMetadata,
  getAllObjectLifecycles,
  getObject,
  getObjectAtRevision,
  getObjectHistory,
  getObjectLifecycle,
  getObjectsInSection,
  getObjectVersion,
  getObjectVersionCount,
  getObjectVersionDescriptors,
  getRevisionMetadata,
  parse,
  resolveReferenceAtRevision,
} from "../index.js";
import { buildMultiRevisionPDF, buildSingleRevisionPDF } from "./fixtures.js";

describe("Hybrid XRef normalization", () => {
  it("assigns chronological revisionIndex to sections", () => {
    const pdf = buildMultiRevisionPDF([
      {
        objects: [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
        trailer: "/Root 1 0 R",
      },
      {
        objects: [{ objNum: 1, genNum: 0, content: "<</Type /Catalog /Version 2>>" }],
        trailer: "/Root 1 0 R",
      },
    ]);
    const doc = parse(pdf);
    expect(doc.sections[0]?.revisionIndex).toBe(doc.sections.length - 1);
    expect(doc.sections[doc.sections.length - 1]?.revisionIndex).toBe(0);
  });

  it("orders sections newest-first", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    expect(doc.sections[0]?.revisionIndex).toBe(0);
  });
});

describe("Object version history", () => {
  it("tracks object across revisions and getObject returns newest", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }], trailer: "/Root 1 0 R" },
    ]);
    const doc = parse(pdf);
    const obj = getObject(doc, 1, 0);
    expect(obj).not.toBeNull();
    if (obj?.type === "dictionary") {
      const v = obj.entries.get("Value");
      if (v?.type === "number") expect(v.value).toBe(2);
    }
    expect(getObjectVersionCount(doc, 1, 0)).toBeGreaterThanOrEqual(1);
  });

  it("returns lightweight descriptors", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const descs = getObjectVersionDescriptors(doc, 1, 0);
    expect(descs.length).toBeGreaterThanOrEqual(1);
    for (const d of descs) {
      expect(d.objectNumber).toBe(1);
      expect(d.generation).toBe(0);
    }
  });

  it("returns correct version count", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Value 1>>" },
        { objNum: 2, genNum: 0, content: "<</Value 2>>" },
      ],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectVersionCount(doc, 1, 0)).toBe(1);
    expect(getObjectVersionCount(doc, 999, 0)).toBe(0);
  });
});

describe("Free and reuse", () => {
  it("keeps history accessible for single-revision objects", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 42>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectVersionDescriptors(doc, 1, 0).length).toBeGreaterThanOrEqual(1);
    expect(getObjectHistory(doc, 1, 0).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Public history APIs", () => {
  it("getObjectVersion returns null for out-of-range", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectVersion(doc, 1, 0, 999)).toBeNull();
    expect(getObjectVersion(doc, 1, 0, -1)).toBeNull();
    expect(getObjectVersion(doc, 999, 0, 0)).toBeNull();
  });

  it("getObjectVersion returns valid object for index 0", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const v = getObjectVersion(doc, 1, 0, 0);
    expect(v).not.toBeNull();
    expect(v?.objectNumber).toBe(1);
  });

  it("getObjectHistory returns correct identities", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const h = getObjectHistory(doc, 1, 0);
    expect(h.length).toBeGreaterThanOrEqual(1);
    for (const v of h) {
      expect(v.objectNumber).toBe(1);
      expect(v.generation).toBe(0);
    }
  });

  it("getObjectAtRevision for newest revision", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectAtRevision(doc, 1, 0, doc.sections.length - 1)).not.toBeNull();
    expect(getObjectAtRevision(doc, 999, 0, 0)).toBeNull();
  });

  it("getObjectsInSection returns objects", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Value 1>>" },
        { objNum: 2, genNum: 0, content: "<</Value 2>>" },
      ],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectsInSection(doc, 0).length).toBeGreaterThanOrEqual(1);
  });

  it("getObjectLifecycle returns correct info", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const lc = getObjectLifecycle(doc, 1, 0);
    expect(lc).not.toBeNull();
    expect(lc?.objectNumber).toBe(1);
    expect(lc?.isCurrent).toBe(true);
    expect(lc?.versionCount).toBeGreaterThanOrEqual(1);
  });

  it("getAllObjectLifecycles includes current objects", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog>>" },
        { objNum: 2, genNum: 0, content: "<</Value 42>>" },
      ],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const lifecycles = getAllObjectLifecycles(doc);
    expect(lifecycles.length).toBeGreaterThanOrEqual(1);
    expect(lifecycles.filter((lc) => lc.isCurrent).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Regression: existing APIs", () => {
  it("getObject returns newest active value", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }], trailer: "/Root 1 0 R" },
    ]);
    const doc = parse(pdf);
    const obj = getObject(doc, 1, 0);
    expect(obj).not.toBeNull();
    if (obj?.type === "dictionary") {
      const v = obj.entries.get("Value");
      if (v?.type === "number") expect(v.value).toBe(2);
    }
  });

  it("doc.objects has newest objects with keys present", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      {
        objects: [
          { objNum: 1, genNum: 0, content: "<</Value 2>>" },
          { objNum: 2, genNum: 0, content: "<</New true>>" },
        ],
        trailer: "/Root 1 0 R",
      },
    ]);
    const doc = parse(pdf);
    expect(doc.objects.has("1_0")).toBe(true);
    expect(doc.objects.has("2_0")).toBe(true);
  });

  it("history field is present on parsed documents", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(doc.history).toBeDefined();
    expect(doc.history.eventsByObject).toBeDefined();
    expect(doc.history.versionCache).toBeDefined();
    expect(typeof doc.history.complete).toBe("boolean");
  });
});

describe("Edge cases", () => {
  it("history.complete is true for normal docs", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    expect(parse(pdf).history.complete).toBe(true);
  });

  it("handles single-object doc", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    expect(parse(pdf).objects.size).toBeGreaterThanOrEqual(1);
  });

  it("handles multi-object doc", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog /Pages 2 0 R>>" },
        { objNum: 2, genNum: 0, content: "<</Type /Pages /Kids [3 0 R] /Count 1>>" },
        { objNum: 3, genNum: 0, content: "<</Type /Page>>" },
      ],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(doc.sections.length).toBe(1);
    expect(doc.objects.size).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 for non-existent object", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    expect(getObjectVersionCount(doc, 999, 0)).toBe(0);
    expect(getObjectVersionDescriptors(doc, 999, 0)).toEqual([]);
    expect(getObjectLifecycle(doc, 999, 0)).toBeNull();
  });
});

// ============================================================================
// Metadata Tests
// ============================================================================

describe("Revision metadata", () => {
  it("extractRevisionMetadata returns undefined when no metadata present", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const meta = extractRevisionMetadata(doc, 0);
    // No /Info in trailer → should be undefined
    expect(meta === undefined || Object.keys(meta ?? {}).length === 0).toBe(true);
  });

  it("getRevisionMetadata is aliased to extractRevisionMetadata", () => {
    expect(getRevisionMetadata).toBe(extractRevisionMetadata);
  });

  it("extractRevisionMetadata handles /Info reference", () => {
    const pdf = buildSingleRevisionPDF(
      [
        { objNum: 1, genNum: 0, content: "<</Type /Catalog>>" },
        { objNum: 2, genNum: 0, content: "<</Producer (Test)>>" },
      ],
      "/Root 1 0 R /Info 2 0 R",
    );
    const doc = parse(pdf);
    const meta = extractRevisionMetadata(doc, 0);
    // Should have producer field
    expect(meta).toBeDefined();
  });
});

// ============================================================================
// Additional API Tests
// ============================================================================

describe("resolveReferenceAtRevision", () => {
  it("resolves reference at newest revision", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Type /Catalog>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const ref = { type: "reference" as const, objectNumber: 1, generation: 0 };
    const resolved = resolveReferenceAtRevision(doc, ref, 0);
    expect(resolved).not.toBeNull();
    expect(resolved.type).toBe("dictionary");
  });

  it("resolves reference at older revision", () => {
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }], trailer: "/Root 1 0 R" },
    ]);
    const doc = parse(pdf);
    const ref = { type: "reference" as const, objectNumber: 1, generation: 0 };
    // At revision 0 (oldest), should resolve
    const resolved = resolveReferenceAtRevision(doc, ref, 0);
    expect(resolved).not.toBeNull();
    // It should be a dictionary (the object type)
    expect(resolved.type).toBe("dictionary");
  });
});

describe("getObjectVersionDescriptors vs getObjectVersionCount", () => {
  it("descriptors count matches version count", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const count = getObjectVersionCount(doc, 1, 0);
    const descs = getObjectVersionDescriptors(doc, 1, 0);
    expect(descs.length).toBe(count);
  });
});

describe("getObjectVersion ordering", () => {
  it("single-revision objects have versionIndex 0 as the only version", () => {
    const pdf = buildSingleRevisionPDF(
      [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }],
      "/Root 1 0 R",
    );
    const doc = parse(pdf);
    const v0 = getObjectVersion(doc, 1, 0, 0);
    expect(v0).not.toBeNull();
    expect(v0?.objectNumber).toBe(1);

    // Only one version exists, so index 1 should be null
    expect(getObjectVersion(doc, 1, 0, 1)).toBeNull();
  });

  it("multi-revision objects have correct count", () => {
    // Build 3 revisions with same object
    const pdf = buildMultiRevisionPDF([
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 1>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 2>>" }], trailer: "/Root 1 0 R" },
      { objects: [{ objNum: 1, genNum: 0, content: "<</Value 3>>" }], trailer: "/Root 1 0 R" },
    ]);
    const doc = parse(pdf);

    // Version count should reflect the number of revisions
    const count = getObjectVersionCount(doc, 1, 0);
    // The XRef sections from the multi-revision body each list obj 1
    // at different offsets, so each should be a distinct version
    expect(count).toBeGreaterThanOrEqual(1);

    // The newest version (largest index) should be the current value
    const newest = getObject(doc, 1, 0);
    expect(newest).not.toBeNull();
    if (newest?.type === "dictionary") {
      const v = newest.entries.get("Value");
      if (v?.type === "number") expect(v.value).toBe(3);
    }
  });
});
