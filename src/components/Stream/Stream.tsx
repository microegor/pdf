import { useMemo } from "react";

import { Tabs, Tab } from "../Tabs";
import type { PDFObject } from "../../reader";
import { decodeStream } from "../../reader";
import { PdfValue } from "../PdfValue";
import { HexView } from "../HexView";

type StreamObject = Extract<PDFObject, { type: "stream" }>;

type Props = {
  value: StreamObject;

  onReferenceClick?: (objectNumber: number, generation: number) => void;
};

function bytesToText(data: Uint8Array, limit = 100_000): string {
  const visible = data.subarray(0, Math.min(data.length, limit));

  const text = new TextDecoder("latin1").decode(visible);

  if (data.length > limit) {
    return `${text}\n\n... truncated (${data.length} bytes total)`;
  }

  return text;
}

export function StreamView({ value, onReferenceClick }: Props) {
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
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [value]);

  return (
    <div>
      <h3>Stream</h3>

      <PdfValue value={value.dictionary} onReferenceClick={onReferenceClick} />

      <h4>Raw data</h4>

      <div>{value.data.length} bytes</div>

      <HexView data={value.data} />

      <h4>Decoded data</h4>

      {!decoded.ok ? (
        <pre>Decode error: {decoded.error}</pre>
      ) : (
        <>
          <div>{decoded.data.length} bytes</div>

          <Tabs defaultValue="text">
            <Tab value="text" text="Text">
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

            <Tab value="hex" text="Hex">
              <HexView data={decoded.data} limit={decoded.data.length} maxHeight={600} />
            </Tab>
          </Tabs>
        </>
      )}
    </div>
  );
}
