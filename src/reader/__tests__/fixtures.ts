/**
 * PDF Fixture Builder — binary-safe
 */

const encoder = new TextEncoder();

function str(s: string): Uint8Array {
  return encoder.encode(s);
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    r.set(a, o);
    o += a.length;
  }
  return r;
}

// PDF header as raw bytes (binary comment must be single bytes > 127)
const HDR = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
]);
const HDR_LEN = HDR.length;

interface FixtureObject {
  objNum: number;
  genNum: number;
  content: string;
}
interface RevisionSpec {
  objects: FixtureObject[];
  trailer?: string;
}

export function buildSingleRevisionPDF(objects: FixtureObject[], trailer?: string): Uint8Array {
  const parts: Uint8Array[] = [HDR];
  const offsets: number[] = [];
  let off = HDR_LEN;

  for (const obj of objects) {
    offsets.push(off);
    const d = str(`${obj.objNum} ${obj.genNum} obj\n${obj.content}\nendobj\n`);
    parts.push(d);
    off += d.length;
  }

  const lines: string[] = ['xref'];
  if (objects.length === 0) {
    lines.push('0 0');
  } else {
    const ix = objects
      .map((o, i) => ({ ...o, offset: offsets[i] ?? 0 }))
      .sort((a, b) => a.objNum - b.objNum);
    lines.push(`${ix[0]?.objNum ?? 0} ${ix.length}`);
    for (const o of ix)
      lines.push(`${String(o.offset).padStart(10, '0')} ${String(o.genNum).padStart(5, '0')} n`);
  }
  const max = objects.reduce((m, o) => Math.max(m, o.objNum), 0);
  const tp: string[] = [`/Size ${max + 1}`];
  if (trailer) tp.push(trailer);
  lines.push(`trailer\n<<${tp.join(' ')}>>`);
  const xref = str(`${lines.join('\n')}\n`);
  const xrefOff = off;
  parts.push(xref);
  parts.push(str(`startxref\n${xrefOff}\n%%EOF`));
  return concat(...parts);
}

export function buildMultiRevisionPDF(revisions: RevisionSpec[]): Uint8Array {
  const all = new Map<string, FixtureObject>();
  const secs: { body: Uint8Array; xref: Uint8Array; xrefOff: number }[] = [];
  let off = HDR_LEN;

  for (let ri = 0; ri < revisions.length; ri++) {
    const rev = revisions[ri];
    if (!rev) continue;
    for (const o of rev.objects) all.set(`${o.objNum}_${o.genNum}`, o);

    const bp: string[] = [];
    for (const o of rev.objects) bp.push(`${o.objNum} ${o.genNum} obj\n${o.content}\nendobj\n`);
    const body = str(bp.join(''));
    off += body.length;

    const objOff = new Map<string, number>();
    let o2 = HDR_LEN;
    for (let rj = 0; rj <= ri; rj++) {
      const rjRev = revisions[rj];
      if (!rjRev) continue;
      for (const o of rjRev.objects) {
        objOff.set(`${o.objNum}_${o.genNum}`, o2);
        o2 += str(`${o.objNum} ${o.genNum} obj\n${o.content}\nendobj\n`).length;
      }
      if (rj < ri) {
        const p = secs[rj];
        if (p) o2 += p.xref.length;
      }
    }

    const lines: string[] = ['xref'];
    const sorted = Array.from(all.values()).sort((a, b) => a.objNum - b.objNum);
    if (sorted.length === 0) {
      lines.push('0 0');
    } else {
      lines.push(`${sorted[0]?.objNum ?? 0} ${sorted.length}`);
      for (const o of sorted) {
        const a = objOff.get(`${o.objNum}_${o.genNum}`) ?? 0;
        lines.push(`${String(a).padStart(10, '0')} ${String(o.genNum).padStart(5, '0')} n`);
      }
    }
    const mx = Array.from(all.values()).reduce((m, o) => Math.max(m, o.objNum), 0);
    const tp: string[] = [`/Size ${mx + 1}`];
    if (ri > 0) {
      const p = secs[ri - 1];
      if (p) tp.push(`/Prev ${p.xrefOff}`);
    }
    if (rev.trailer) tp.push(rev.trailer);
    lines.push(`trailer\n<<${tp.join(' ')}>>`);
    const xref = str(`${lines.join('\n')}\n`);
    const xrefOff = off;
    secs.push({ body, xref, xrefOff });
    off += xref.length;
  }

  const parts: Uint8Array[] = [HDR];
  for (const s of secs) {
    parts.push(s.body);
    parts.push(s.xref);
  }
  parts.push(str(`startxref\n${secs[secs.length - 1]?.xrefOff ?? 0}\n%%EOF`));
  return concat(...parts);
}
