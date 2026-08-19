/** Shared, bounded PDF stream filter pipeline. */

import type { ParseLimits, PDFDictionary, PDFObject, PDFStream } from './types.js';
import { DEFAULT_PARSE_LIMITS } from './types.js';
import { inflate } from './xref/flate.js';

export function decodeStream(
  stream: PDFStream,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS
): Uint8Array {
  if (stream.data.length > limits.maxStreamBytes) {
    throw new Error(
      `Stream raw size ${stream.data.length} exceeds maximum allowed (${limits.maxStreamBytes} bytes)`
    );
  }

  const filterObject = stream.dictionary.entries.get('Filter');
  if (!filterObject) {
    if (stream.data.length > limits.maxDecodedStreamBytes) {
      throw new Error(
        `Decoded stream size ${stream.data.length} exceeds maximum allowed (${limits.maxDecodedStreamBytes} bytes)`
      );
    }
    return stream.data;
  }

  const filters = getFilterNames(filterObject);
  const decodeParms = getDecodeParms(stream.dictionary.entries.get('DecodeParms'), filters.length);
  let data = stream.data;

  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    if (!filter) continue;
    const params = decodeParms[i];

    switch (filter) {
      case 'FlateDecode':
        data = inflate(data, limits.maxDecodedStreamBytes);
        data = applyPredictor(data, params);
        break;
      case 'ASCIIHexDecode':
        data = decodeASCIIHex(data, limits.maxDecodedStreamBytes);
        break;
      case 'ASCII85Decode':
        data = decodeASCII85(data, limits.maxDecodedStreamBytes);
        break;
      default:
        throw new Error(`Unsupported stream filter: ${filter}`);
    }

    if (data.length > limits.maxDecodedStreamBytes) {
      throw new Error(
        `Decoded stream size ${data.length} exceeds maximum allowed (${limits.maxDecodedStreamBytes} bytes)`
      );
    }
  }

  return data;
}

function getFilterNames(value: PDFObject): string[] {
  if (value.type === 'name') return [value.value];
  if (value.type !== 'array') {
    throw new Error('Stream /Filter must be a name or array of names');
  }
  return value.items.map((item, index) => {
    if (item.type !== 'name') throw new Error(`Stream /Filter[${index}] must be a name`);
    return item.value;
  });
}

function getDecodeParms(
  value: PDFObject | undefined,
  count: number
): (PDFDictionary | undefined)[] {
  if (!value) return new Array(count).fill(undefined);
  if (value.type === 'dictionary')
    return [value, ...new Array(Math.max(0, count - 1)).fill(undefined)];
  if (value.type !== 'array') throw new Error('Stream /DecodeParms must be a dictionary or array');
  return value.items.map(item => (item.type === 'dictionary' ? item : undefined));
}

function applyPredictor(data: Uint8Array, params: PDFDictionary | undefined): Uint8Array {
  const predictor = getNumber(params, 'Predictor') ?? 1;
  if (predictor === 1) return data;

  const columns = getNumber(params, 'Columns') ?? 1;
  const colors = getNumber(params, 'Colors') ?? 1;
  const bitsPerComponent = getNumber(params, 'BitsPerComponent') ?? 8;
  if (
    !Number.isInteger(columns) ||
    columns <= 0 ||
    !Number.isInteger(colors) ||
    colors <= 0 ||
    !Number.isInteger(bitsPerComponent) ||
    bitsPerComponent <= 0
  ) {
    throw new Error('Invalid Flate predictor parameters');
  }
  if (![1, 2, 4, 8, 16].includes(bitsPerComponent)) {
    throw new Error(`Unsupported Flate predictor BitsPerComponent: ${bitsPerComponent}`);
  }

  if (predictor === 2) {
    return decodeTiffPredictor(data, columns * colors, colors, bitsPerComponent);
  }
  if (predictor >= 10 && predictor <= 15) {
    return decodePNGPredictor(
      data,
      Math.ceil((columns * colors * bitsPerComponent) / 8),
      Math.ceil((colors * bitsPerComponent) / 8)
    );
  }
  throw new Error(`Unsupported Flate predictor: ${predictor}`);
}

function getNumber(dict: PDFDictionary | undefined, key: string): number | undefined {
  const value = dict?.entries.get(key);
  return value?.type === 'number' ? value.value : undefined;
}

function decodeTiffPredictor(
  data: Uint8Array,
  samplesPerRow: number,
  samplesPerPixel: number,
  bitsPerComponent: number
): Uint8Array {
  const rowBytes = Math.ceil((samplesPerRow * bitsPerComponent) / 8);
  if (rowBytes <= 0 || data.length % rowBytes !== 0) {
    throw new Error('Invalid TIFF predictor row length');
  }

  const result = new Uint8Array(data);

  for (let rowStart = 0; rowStart < result.length; rowStart += rowBytes) {
    if (bitsPerComponent === 8) {
      for (let sample = samplesPerPixel; sample < samplesPerRow; sample++) {
        const currentOffset = rowStart + sample;
        const previousOffset = rowStart + sample - samplesPerPixel;
        result[currentOffset] =
          ((result[currentOffset] ?? 0) + (result[previousOffset] ?? 0)) & 0xff;
      }
      continue;
    }

    if (bitsPerComponent === 16) {
      const bytesPerSample = 2;
      const bytesPerPixel = samplesPerPixel * bytesPerSample;
      for (let sample = samplesPerPixel; sample < samplesPerRow; sample++) {
        const currentOffset = rowStart + sample * bytesPerSample;
        const previousOffset = currentOffset - bytesPerPixel;
        const current = ((result[currentOffset] ?? 0) << 8) | (result[currentOffset + 1] ?? 0);
        const previous = ((result[previousOffset] ?? 0) << 8) | (result[previousOffset + 1] ?? 0);
        const value = (current + previous) & 0xffff;
        result[currentOffset] = value >>> 8;
        result[currentOffset + 1] = value & 0xff;
      }
      continue;
    }

    const mask = (1 << bitsPerComponent) - 1;
    for (let sample = samplesPerPixel; sample < samplesPerRow; sample++) {
      const currentOffset = sample * bitsPerComponent;
      const previousOffset = (sample - samplesPerPixel) * bitsPerComponent;
      const current = readPackedSample(result, rowStart * 8 + currentOffset, bitsPerComponent);
      const previous = readPackedSample(result, rowStart * 8 + previousOffset, bitsPerComponent);
      writePackedSample(
        result,
        rowStart * 8 + currentOffset,
        bitsPerComponent,
        (current + previous) & mask
      );
    }
  }
  return result;
}

function readPackedSample(data: Uint8Array, bitOffset: number, bits: number): number {
  let value = 0;
  for (let bit = 0; bit < bits; bit++) {
    const absoluteBit = bitOffset + bit;
    const byte = data[Math.floor(absoluteBit / 8)] ?? 0;
    value = (value << 1) | ((byte >>> (7 - (absoluteBit % 8))) & 1);
  }
  return value;
}

function writePackedSample(data: Uint8Array, bitOffset: number, bits: number, value: number): void {
  for (let bit = 0; bit < bits; bit++) {
    const absoluteBit = bitOffset + bit;
    const byteIndex = Math.floor(absoluteBit / 8);
    const mask = 1 << (7 - (absoluteBit % 8));
    if ((value >>> (bits - bit - 1)) & 1) {
      data[byteIndex] = (data[byteIndex] ?? 0) | mask;
    } else {
      data[byteIndex] = (data[byteIndex] ?? 0) & ~mask;
    }
  }
}

function decodePNGPredictor(data: Uint8Array, rowBytes: number, bytesPerPixel: number): Uint8Array {
  const encodedRowLength = rowBytes + 1;
  if (encodedRowLength <= 1 || data.length % encodedRowLength !== 0) {
    throw new Error('Invalid PNG predictor row length');
  }
  const rows = data.length / encodedRowLength;
  const result = new Uint8Array(rows * rowBytes);
  let previousRow: Uint8Array | undefined;

  for (let row = 0; row < rows; row++) {
    const inputStart = row * encodedRowLength;
    const outputStart = row * rowBytes;
    const predictor = data[inputStart] ?? 0;
    for (let col = 0; col < rowBytes; col++) {
      const raw = data[inputStart + 1 + col] ?? 0;
      const left = col >= bytesPerPixel ? (result[outputStart + col - bytesPerPixel] ?? 0) : 0;
      const up = previousRow?.[col] ?? 0;
      const upLeft = col >= bytesPerPixel ? (previousRow?.[col - bytesPerPixel] ?? 0) : 0;
      let value = raw;
      switch (predictor) {
        case 0:
          break;
        case 1:
          value = (raw + left) & 0xff;
          break;
        case 2:
          value = (raw + up) & 0xff;
          break;
        case 3:
          value = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          value = (raw + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG predictor row type: ${predictor}`);
      }
      result[outputStart + col] = value;
    }
    previousRow = result.subarray(outputStart, outputStart + rowBytes);
  }
  return result;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const STREAM_FILTER_CHUNK_SIZE = 16 * 1024;

class ByteAccumulator {
  private readonly chunks: Uint8Array[] = [];
  private currentChunk: Uint8Array | undefined;
  private currentOffset = 0;
  private totalLength = 0;
  private readonly maxOutputBytes: number;
  private readonly filterName: string;

  constructor(
    maxOutputBytes: number,
    filterName: string
  ) {
    this.maxOutputBytes = maxOutputBytes;
    this.filterName = filterName;
  }

  get length(): number {
    return this.totalLength;
  }

  push(byte: number): void {
    this.ensureCapacity(1);
    if (!this.currentChunk || this.currentOffset === this.currentChunk.length) {
      this.currentChunk = new Uint8Array(STREAM_FILTER_CHUNK_SIZE);
      this.chunks.push(this.currentChunk);
      this.currentOffset = 0;
    }
    this.currentChunk[this.currentOffset] = byte;
    this.currentOffset++;
    this.totalLength++;
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      if (!chunk) continue;
      const length = index === this.chunks.length - 1 ? this.currentOffset : chunk.length;
      result.set(chunk.subarray(0, length), offset);
      offset += length;
    }
    return result;
  }

  private ensureCapacity(additionalLength: number): void {
    if (
      this.maxOutputBytes !== Infinity &&
      (this.totalLength > this.maxOutputBytes ||
        additionalLength > this.maxOutputBytes - this.totalLength)
    ) {
      throw new Error(
        `${this.filterName} output exceeds maximum decoded stream size (${this.maxOutputBytes} bytes)`
      );
    }
  }
}

function decodeASCIIHex(data: Uint8Array, maxOutputBytes: number): Uint8Array {
  const result = new ByteAccumulator(maxOutputBytes, 'ASCIIHexDecode');
  let high: number | undefined;
  for (const byte of data) {
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c) continue;
    if (byte === 0x3e) break;
    const nibble = hexNibble(byte);
    if (nibble < 0) throw new Error(`Invalid ASCIIHex byte 0x${byte.toString(16)}`);
    if (high === undefined) high = nibble;
    else {
      result.push((high << 4) | nibble);
      high = undefined;
    }
  }
  if (high !== undefined) {
    result.push(high << 4);
  }
  return result.toUint8Array();
}

function hexNibble(byte: number): number {
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x41 + 10;
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x61 + 10;
  return -1;
}

function decodeASCII85(data: Uint8Array, maxOutputBytes: number): Uint8Array {
  const result = new ByteAccumulator(maxOutputBytes, 'ASCII85Decode');
  let tuple = 0;
  let count = 0;
  for (let index = 0; index < data.length; index++) {
    const byte = data[index] ?? 0;
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c) continue;
    if (byte === 0x7e) {
      if (data[index + 1] !== 0x3e) {
        throw new Error('Invalid ASCII85 end marker: expected > after ~');
      }
      break;
    }
    if (byte === 0x7a) {
      if (count !== 0) throw new Error('Invalid ASCII85 z shortcut');
      result.push(0);
      result.push(0);
      result.push(0);
      result.push(0);
      continue;
    }
    if (byte < 0x21 || byte > 0x75) throw new Error(`Invalid ASCII85 byte 0x${byte.toString(16)}`);
    tuple = tuple * 85 + byte - 0x21;
    count++;
    if (count === 5) {
      if (tuple > 0xffffffff) throw new Error('ASCII85 tuple exceeds 0xffffffff');
      result.push((tuple >>> 24) & 0xff);
      result.push((tuple >>> 16) & 0xff);
      result.push((tuple >>> 8) & 0xff);
      result.push(tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }
  if (count > 0) {
    if (count === 1) throw new Error('Invalid trailing ASCII85 tuple');
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84;
    if (tuple > 0xffffffff) throw new Error('ASCII85 tuple exceeds 0xffffffff');
    for (let i = 0; i < count - 1; i++) {
      result.push((tuple >>> (24 - i * 8)) & 0xff);
    }
  }
  return result.toUint8Array();
}
