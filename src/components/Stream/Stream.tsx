import { useMemo } from "react";

import { Tabs, Tab } from "../Tabs";
import type { PDFObject } from "../../reader";
import { decodeStream } from "../../reader";
import { HexView } from "../HexView";

type StreamObject = Extract<PDFObject, { type: "stream" }>;

type Props = {
  value: StreamObject;
};

function bytesToText(data: Uint8Array, limit = 100_000): string {
  const visible = data.subarray(0, Math.min(data.length, limit));

  const text = new TextDecoder("latin1").decode(visible);

  if (data.length > limit) {
    return `${text}\n\n... truncated (${data.length} bytes total)`;
  }

  return text;
}

export function StreamView({ value }: Props) {
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
    <section>
      <h3>Stream</h3>

      <hr />

      {!decoded.ok ? (
        <pre>Decode error: {decoded.error}</pre>
      ) : (
        <>
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
    </section>
  );
}
