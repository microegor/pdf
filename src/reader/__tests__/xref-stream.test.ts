import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getCatalog, getSections, getTrailer, parse } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "..", "..", "data");
const hasData = existsSync(join(dataDir, "xref_stream.pdf"));
const itWithData = hasData ? it : it.skip;

describe("XRef Stream", () => {
  itWithData("should parse PDF with XRef stream", () => {
    const buffer = readFileSync(join(dataDir, "xref_stream.pdf"));
    const doc = parse(new Uint8Array(buffer));

    expect(doc).toBeDefined();
    expect(doc.version).toBeDefined();
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  itWithData("should have valid trailer (from XRef stream dict)", () => {
    const buffer = readFileSync(join(dataDir, "xref_stream.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const trailer = getTrailer(doc);
    expect(trailer).not.toBeNull();
    expect(trailer?.entries.has("Root")).toBe(true);
  });

  itWithData("should have valid catalog", () => {
    const buffer = readFileSync(join(dataDir, "xref_stream.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const catalog = getCatalog(doc);
    expect(catalog).not.toBeNull();
    expect(catalog?.entries.get("Type")).toEqual({ type: "name", value: "Catalog" });
  });

  itWithData("should parse XRef entries correctly", () => {
    const buffer = readFileSync(join(dataDir, "xref_stream.pdf"));
    const doc = parse(new Uint8Array(buffer));

    const sections = getSections(doc);
    expect(sections.length).toBeGreaterThan(0);

    const firstSection = sections[0];
    expect(firstSection).toBeDefined();
    expect(firstSection?.entries.size).toBeGreaterThan(0);
  });

  itWithData("should parse objects", () => {
    const buffer = readFileSync(join(dataDir, "xref_stream.pdf"));
    const doc = parse(new Uint8Array(buffer));

    expect(doc.objects.size).toBeGreaterThan(0);
  });
});
