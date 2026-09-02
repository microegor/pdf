import type { PDFObject } from "../../reader";
import { decodePDFString } from "../../reader";
import styles from "./PdfValue.module.css";

type Props = {
  value: PDFObject;
  depth?: number;
  onReferenceClick?: (
    objectNumber: number,
    generation: number,
  ) => void;
};

const MAX_DEPTH = 20;

function bytesToHexPreview(
  raw: Uint8Array,
  limit = 64,
): string {
  const len = Math.min(raw.length, limit);
  const parts: string[] = [];

  for (let i = 0; i < len; i++) {
    parts.push(
      (raw[i] ?? 0)
        .toString(16)
        .padStart(2, "0"),
    );
  }

  return (
    parts.join(" ") +
    (raw.length > limit ? " ..." : "")
  );
}

export function PdfValue({
  value,
  depth = 0,
  onReferenceClick,
}: Props) {
  if (depth > MAX_DEPTH) {
    return (
      <span className={styles.depthLimit}>
        Max depth reached
      </span>
    );
  }

  switch (value.type) {
    case "null":
      return (
        <span className={styles.null}>
          null
        </span>
      );

    case "boolean":
      return (
        <span className={styles.boolean}>
          {value.value ? "true" : "false"}
        </span>
      );

    case "number":
      return (
        <span className={styles.number}>
          {String(value.value)}
        </span>
      );

    case "name":
      return (
        <span className={styles.name}>
          /{value.value}
        </span>
      );

    case "string": {
      const decoded = decodePDFString(value.raw);

      return (
        <span
          className={styles.string}
          title={bytesToHexPreview(value.raw)}
        >
          {decoded}
        </span>
      );
    }

    case "hexstring": {
      const decoded = decodePDFString(value.raw);

      const hex = bytesToHexPreview(
        value.raw,
        32,
      ).replaceAll(" ", "");

      return (
        <span
          className={styles.hexstring}
          title={decoded}
        >
          &lt;{hex}
          {value.raw.length > 32 ? "..." : ""}
          &gt;
        </span>
      );
    }

    case "reference":
      return (
        <button
          type="button"
          className={styles.reference}
          onClick={() =>
            onReferenceClick?.(
              value.objectNumber,
              value.generation,
            )
          }
        >
          {value.objectNumber}{" "}
          {value.generation} R
        </button>
      );

    case "array": {
      if (value.items.length === 0) {
        return (
          <span className={styles.empty}>
            []
          </span>
        );
      }

      return (
        <div className={styles.array}>
          {value.items.map((item, index) => (
            <div
              key={index}
              className={styles.arrayRow}
            >
              <span
                className={
                  styles.arrayIndex
                }
              >
                {index}
              </span>

              <div
                className={
                  styles.arrayValue
                }
              >
                <PdfValue
                  value={item}
                  depth={depth + 1}
                  onReferenceClick={
                    onReferenceClick
                  }
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "dictionary": {
      if (value.entries.size === 0) {
        return (
          <span className={styles.empty}>
            Empty dictionary
          </span>
        );
      }

      return (
        <div className={styles.dictionary}>
          {Array.from(
            value.entries.entries(),
          ).map(([key, entry]) => (
            <div
              key={key}
              className={styles.dictRow}
            >
              <div
                className={styles.dictKey}
              >
                /{key}
              </div>

              <div
                className={
                  styles.dictValue
                }
              >
                <PdfValue
                  value={entry}
                  depth={depth + 1}
                  onReferenceClick={
                    onReferenceClick
                  }
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case "stream":
      return (
        <div className={styles.stream}>
          <div className={styles.streamDict}>
            <PdfValue
              value={value.dictionary}
              depth={depth + 1}
              onReferenceClick={
                onReferenceClick
              }
            />
          </div>

          <div className={styles.streamMeta}>
            <span>
              Stream
            </span>

            <span>
              {value.data.length} bytes
            </span>
          </div>

          {value.data.length > 0 && (
            <div
              className={
                styles.streamPreview
              }
              title={bytesToHexPreview(
                value.data,
                128,
              )}
            >
              {bytesToHexPreview(
                value.data,
                24,
              )}

              {value.data.length > 24
                ? " ..."
                : ""}
            </div>
          )}
        </div>
      );

    default:
      return (
        <span className={styles.empty}>
          —
        </span>
      );
  }
}