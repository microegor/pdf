/** Canonical PDF string/name decoding shared by document and history APIs. */

export function decodePDFString(raw: Uint8Array): string {
  if (raw.length === 0) return "";
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    return decodeUTF16BE(raw.subarray(2));
  }
  return decodePDFDocEncoding(raw);
}

export function decodePDFNameValue(nameValue: string): string {
  if (nameValue.length < 2) return nameValue;

  const bytes = new Uint8Array(nameValue.length);
  for (let i = 0; i < nameValue.length; i++) {
    bytes[i] = nameValue.charCodeAt(i) & 0xff;
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUTF16BE(bytes.subarray(2));
  }
  return nameValue;
}

function decodeUTF16BE(bytes: Uint8Array): string {
  // Keep the spread passed to String.fromCharCode bounded. A single large
  // spread over a normal PDF string can exceed V8's argument limit.
  const chunkCodeUnits = 8_192;
  const chunkBytes = chunkCodeUnits * 2;
  let result = "";

  for (let start = 0; start + 1 < bytes.length; start += chunkBytes) {
    const end = Math.min(start + chunkBytes, bytes.length);
    const chars: number[] = [];
    for (let i = start; i + 1 < end; i += 2) {
      chars.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
    }
    result += String.fromCharCode(...chars);
  }

  return result;
}

function decodePDFDocEncoding(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += String.fromCodePoint(pdfDocEncodingToUnicode(byte));
  }
  return result;
}

function pdfDocEncodingToUnicode(byte: number): number {
  const special: Record<number, number> = {
    24: 0x02d8,
    25: 0x02c7,
    26: 0x02c6,
    27: 0x02d9,
    28: 0x02dd,
    29: 0x02db,
    30: 0x02da,
    31: 0x02dc,
    127: 0xfffd,
    128: 0x2022,
    129: 0x2020,
    130: 0x2021,
    131: 0x2026,
    132: 0x2014,
    133: 0x2013,
    134: 0x0192,
    135: 0x2044,
    136: 0x2039,
    137: 0x203a,
    138: 0x2212,
    139: 0x2030,
    140: 0x201e,
    141: 0x201c,
    142: 0x201d,
    143: 0x2018,
    144: 0x2019,
    145: 0x201a,
    146: 0x2122,
    147: 0xfb01,
    148: 0xfb02,
    149: 0x0141,
    150: 0x0152,
    151: 0x0160,
    152: 0x0178,
    153: 0x017d,
    154: 0x0131,
    155: 0x0142,
    156: 0x0153,
    157: 0x0161,
    158: 0x017e,
    159: 0xfffd,
    160: 0x20ac,
    173: 0xfffd,
  };
  return special[byte] ?? byte;
}
