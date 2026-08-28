import { useMemo } from "react";

import { Tabs, Tab } from "../Tabs";
import type { PDFObject } from "../../reader";
import { decodeStream } from "../../reader";
import { PdfValue } from "../PdfValue";

type StreamObject = Extract<
  PDFObject,
  { type: "stream" }
>;

type Props = {
  value: StreamObject;

  onReferenceClick?: (
    objectNumber: number,
    generation: number,
  ) => void;
};

function bytesToHex(
  raw: Uint8Array,
  limit = 128,
  bytesPerLine = 16,
): string {
  const length = Math.min(raw.length, limit);
  const lines: string[] = [];

  for (
    let i = 0;
    i < length;
    i += bytesPerLine
  ) {
    const chunk = raw.subarray(
      i,
      Math.min(i + bytesPerLine, length),
    );

    const hex = Array.from(chunk)
      .map((byte) =>
        byte.toString(16).padStart(2, "0"),
      )
      .join(" ");

    const text = Array.from(chunk)
      .map((byte) => {
        if (byte >= 32 && byte <= 126) {
          return String.fromCharCode(byte);
        }

        return ".";
      })
      .join("");

    const hexWidth =
      bytesPerLine * 3 - 1;

    lines.push(
      `${hex.padEnd(hexWidth, " ")}  | ${text}`,
    );
  }

  if (raw.length > limit) {
    lines.push("...");
  }

  return lines.join("\n");
}

function bytesToText(
  data: Uint8Array,
  limit = 100_000,
): string {
  const visible = data.subarray(
    0,
    Math.min(data.length, limit),
  );

  const text =
    new TextDecoder("latin1").decode(visible);

  if (data.length > limit) {
    return `${text}\n\n... truncated (${data.length} bytes total)`;
  }

  return text;
}

export function StreamView({
  value,
  onReferenceClick,
}: Props) {
  const decoded = useMemo(() => {
    try {
      const data = decodeStream(value);

      return {
        ok: true as const,
        data,
        text: bytesToText(data),
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      };
    }
  }, [value]);

  return (
    <div>
      <h3>Stream</h3>

      <PdfValue
        value={value.dictionary}
        onReferenceClick={onReferenceClick}
      />

      <h4>Raw data</h4>

      <div>{value.data.length} bytes</div>

      <pre>
        {bytesToHex(value.data)}
      </pre>

      <h4>Decoded data</h4>

      {!decoded.ok ? (
        <pre>
          Decode error: {decoded.error}
        </pre>
      ) : (
        <>
          <div>
            {decoded.data.length} bytes
          </div>

          <Tabs defaultValue="text">
            <Tab
              value="text"
              text="Text"
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  overflow: "auto",
                  maxHeight: 600,
                }}
              >
                {decoded.text}
              </pre>
            </Tab>

            <Tab
              value="hex"
              text="Hex"
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  overflow: "auto",
                  maxHeight: 600,
                }}
              >
                {bytesToHex(
                  decoded.data,
                  decoded.data.length,
                )}
              </pre>
            </Tab>
          </Tabs>
        </>
      )}
    </div>
  );
}