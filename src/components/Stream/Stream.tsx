import { useMemo } from "react";

import { Tabs, Tab } from "../Tabs";
import type { PDFObject } from "../../reader";
import { decodeStream } from "../../reader";
import { PdfValue } from "../PdfValue";
import { HexView } from "../HexView";

type StreamObject = Extract<PDFObject, { type: "stream" }>;

type Props = {
  value: StreamObject;
  onReferenceClick?: (
    objectNumber: number,
    generation: number,
  ) => void;
};

type StreamTextProps = {
  text: string;
  onReferenceClick?: (
    objectNumber: number,
    generation: number,
  ) => void;
};

function bytesToText(data: Uint8Array, limit = 100_000): string {
  const visible = data.subarray(
    0,
    Math.min(data.length, limit),
  );

  const text = new TextDecoder("latin1").decode(visible);

  if (data.length > limit) {
    return `${text}\n\n... truncated (${data.length} bytes total)`;
  }

  return text;
}

function StreamText({
  text,
  onReferenceClick,
}: StreamTextProps) {
  // Не матчим R внутри операторов RG и т.п.
  const referenceRegex = /(\d+)\s+(\d+)\s+R(?![A-Za-z])/g;

  const result: React.ReactNode[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = referenceRegex.exec(text)) !== null) {
    result.push(text.slice(lastIndex, match.index));

    const objectNumber = Number(match[1]);
    const generation = Number(match[2]);

    result.push(
      <button
        key={`${match.index}-${objectNumber}-${generation}`}
        type="button"
        onClick={() => {
          console.log(
            "reference click:",
            objectNumber,
            generation,
          );

          onReferenceClick?.(
            objectNumber,
            generation,
          );
        }}
      >
        {objectNumber} {generation} R
      </button>,
    );

    lastIndex = referenceRegex.lastIndex;
  }

  result.push(text.slice(lastIndex));

  return <>{result}</>;
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
                <StreamText
                  text={decoded.text}
                  onReferenceClick={onReferenceClick}
                />
              </pre>
            </Tab>

            <Tab value="hex" text="Hex">
              <HexView
                data={decoded.data}
                limit={decoded.data.length}
                maxHeight={600}
              />
            </Tab>
          </Tabs>
        </>
      )}
    </div>
  );
}