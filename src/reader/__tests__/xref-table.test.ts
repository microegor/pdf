import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getCatalog, getSections, getTrailer, parse } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "..", "..", "data");

describe("XRef Table", () => {
  it("should parse PDF with XRef table", () => {
    const buffer = readFileSync(join(dataDir, "xref_table.pdf"));
    const doc = parse(new Uint8Array(buffer));

    expect(doc).toBeDefined();
    expect(doc.version).toBeDefined();
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it("should have valid trailer", () => {
    const buffer = readFileSync(join(dataDir, "xref_table.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const trailer = getTrailer(doc);
    expect(trailer).not.toBeNull();
    expect(trailer?.entries.has("Root")).toBe(true);
  });

  it("should have valid catalog", () => {
    const buffer = readFileSync(join(dataDir, "xref_table.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const catalog = getCatalog(doc);
    expect(catalog).not.toBeNull();
    expect(catalog?.entries.get("Type")).toEqual({ type: "name", value: "Catalog" });
  });

  it("should parse XRef entries correctly", () => {
    const buffer = readFileSync(join(dataDir, "xref_table.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const sections = getSections(doc);
    expect(sections.length).toBeGreaterThan(0);

    const firstSection = sections[0];
    expect(firstSection).toBeDefined();
    expect(firstSection?.entries.size).toBeGreaterThan(0);
  });

  it("should parse objects", () => {
    const buffer = readFileSync(join(dataDir, "xref_table.pdf"));
    const doc = parse(new Uint8Array(buffer));

    expect(doc.objects.size).toBeGreaterThan(0);
  });
});
