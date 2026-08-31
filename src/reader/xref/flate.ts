/**
 * Flate/Deflate Decompression
 * Uses pako for cross-platform compatibility (browser, Node.js, Electron)
 */

import { Inflate } from "pako";

/**
 * Inflate (decompress) data compressed with zlib/deflate
 * @param data Compressed data (Uint8Array)
 * @returns Decompressed data (Uint8Array)
 */
export function inflate(data: Uint8Array, maxOutputBytes: number = 200 * 1024 * 1024): Uint8Array {
  if (maxOutputBytes < 0) {
    throw new Error(`Invalid maximum decompressed size: ${maxOutputBytes}`);
  }
  if (maxOutputBytes === Infinity) {
    return inflate(data);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflator = new Inflate({
    chunkSize: Math.min(16 * 1024, Math.max(1, maxOutputBytes)),
  });
  inflator.onData = (chunk) => {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    total += bytes.length;
    if (total > maxOutputBytes) {
      throw new Error(`Decoded stream size exceeds maximum allowed (${maxOutputBytes} bytes)`);
    }
    chunks.push(bytes);
  };

  try {
    if (!inflator.push(data, true)) {
      throw new Error(inflator.msg || "Failed to inflate stream");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Decoded stream size")) {
      throw error;
    }
    throw new Error(
      `Failed to inflate stream: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
