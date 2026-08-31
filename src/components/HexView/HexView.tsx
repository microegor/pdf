import { useEffect, useMemo, useRef, useState } from "react";

type HexViewProps = {
  data: Uint8Array;
  limit?: number;
  bytesPerLine?: number;
  maxHeight?: number;
};

export function HexView({ data, limit = 128, bytesPerLine = 16, maxHeight = 600 }: HexViewProps) {
  const [selectedByte, setSelectedByte] = useState<number | null>(null);

  const [scrollTop, setScrollTop] = useState(0);

  const [viewportHeight, setViewportHeight] = useState(maxHeight);

  const containerRef = useRef<HTMLPreElement>(null);

  const length = Math.min(data.length, limit);

  /*
   * Важно: высота каждой строки должна быть
   * фиксированной для виртуализации.
   */
  const lineHeight = 20;

  /*
   * Дополнительные строки сверху/снизу,
   * чтобы при прокрутке не было мерцания.
   */
  const overscan = 10;

  const totalLines = Math.ceil(length / bytesPerLine);

  const totalHeight = totalLines * lineHeight;

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateHeight = () => {
      setViewportHeight(element.clientHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - overscan);

  const endLine = Math.min(
    totalLines,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + overscan,
  );

  /*
   * Создаются только номера ВИДИМЫХ строк.
   *
   * Например:
   * totalLines = 1 000 000
   *
   * visibleLines будет содержать только
   * примерно 40-60 элементов.
   */
  const visibleLines = useMemo(() => {
    const result: number[] = [];

    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      result.push(lineIndex);
    }

    return result;
  }, [startLine, endLine]);

  function getByteStyle(index: number) {
    const isSelected = selectedByte === index;

    return {
      cursor: "pointer",
      backgroundColor: isSelected ? "#d1d5db" : "transparent",
      color: "inherit",
    };
  }

  return (
    <pre
      ref={containerRef}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
      style={{
        position: "relative",
        whiteSpace: "pre",
        overflow: "auto",
        maxHeight,
        height: maxHeight,
        margin: 0,
        lineHeight: `${lineHeight}px`,
        fontFamily: "monospace",
      }}
    >
      {/*
       * Этот div создаёт виртуальную высоту
       * всего hex-viewer.
       *
       * Но строки внутри НЕ рендерятся все.
       */}
      <div
        style={{
          position: "relative",
          height: totalHeight,

          /*
           * Чтобы horizontal scroll
           * продолжал работать.
           */
          width: `${bytesPerLine * 4 + 4}ch`,
        }}
      >
        {visibleLines.map((lineIndex) => {
          const start = lineIndex * bytesPerLine;

          const end = Math.min(start + bytesPerLine, length);

          const lineLength = end - start;

          const missingBytes = bytesPerLine - lineLength;

          return (
            <div
              key={lineIndex}
              style={{
                position: "absolute",

                top: lineIndex * lineHeight,

                left: 0,

                height: lineHeight,

                lineHeight: `${lineHeight}px`,

                whiteSpace: "pre",
              }}
            >
              {/*
               * HEX
               */}
              {Array.from(
                {
                  length: lineLength,
                },
                (_, indexInLine) => {
                  const index = start + indexInLine;

                  return (
                    <span
                      key={`hex-${index}`}
                      style={getByteStyle(index)}
                      onClick={() => setSelectedByte(index)}
                    >
                      {data[index].toString(16).padStart(2, "0")}

                      {indexInLine < lineLength - 1 ? " " : ""}
                    </span>
                  );
                },
              )}

              {missingBytes > 0 ? " ".repeat(missingBytes * 3) : ""}

              {"  | "}

              {/*
               * ASCII
               */}
              {Array.from(
                {
                  length: lineLength,
                },
                (_, indexInLine) => {
                  const index = start + indexInLine;

                  const byte = data[index];

                  const character = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";

                  return (
                    <span
                      key={`text-${index}`}
                      style={getByteStyle(index)}
                      onClick={() => setSelectedByte(index)}
                    >
                      {character}
                    </span>
                  );
                },
              )}
            </div>
          );
        })}
      </div>
    </pre>
  );
}
