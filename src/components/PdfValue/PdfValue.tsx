import type { PDFObject } from "../../reader";
import { decodePDFString } from "../../reader";
import styles from "./PdfValue.module.css";

type Props = {
  value: PDFObject;
  depth?: number;
  onReferenceClick?: (objectNumber: number, generation: number) => void;
};

const MAX_DEPTH = 20;

function bytesToHexPreview(raw: Uint8Array, limit = 64): string {
  const len = Math.min(raw.length, limit);
  const parts: string[] = [];
  for (let i = 0; i < len; i++) {
    parts.push((raw[i] ?? 0).toString(16).padStart(2, "0"));
  }
  return parts.join(" ") + (raw.length > limit ? " ..." : "");
}

export function PdfValue({ value, depth = 0, onReferenceClick }: Props) {
  if (depth > MAX_DEPTH) {
    return <span className={styles.depthLimit}>... max depth</span>;
  }

  switch (value.type) {
    case "null":
      return <span className={styles.null}>null</span>;

    case "boolean":
      return <span className={styles.boolean}>{value.value ? "true" : "false"}</span>;

    case "number":
      return <span className={styles.number}>{String(value.value)}</span>;

    case "name":
      return <span className={styles.name}>/{value.value}</span>;

    case "string": {
      const decoded = decodePDFString(value.raw);
      return (
        <span className={styles.string} title={bytesToHexPreview(value.raw)}>
          ({decoded})
        </span>
      );
    }

    case "hexstring": {
      const decoded = decodePDFString(value.raw);
      const hex = bytesToHexPreview(value.raw, 32).replaceAll(" ", "");
      return (
        <span className={styles.hexstring} title={decoded}>
          &lt;{hex}
          {value.raw.length > 32 ? "..." : ""}&gt;
        </span>
      );
    }

    case "reference":
      return (
        <button
          type="button"
          className={styles.reference}
          onClick={() => onReferenceClick?.(value.objectNumber, value.generation)}
        >
          {value.objectNumber} {value.generation} R
        </button>
      );

    case "array": {
      if (value.items.length === 0) {
        return <span className={styles.array}>[]</span>;
      }

      return (
        <span className={styles.array}>
          <span>[</span>

          <div className={styles.nested} style={{ paddingLeft: 12 }}>
            {value.items.map((item, idx) => (
              <div key={idx} className={styles.arrayItem}>
                <span className={styles.arrayIndex}>{idx}:</span>{" "}
                <PdfValue value={item} depth={depth + 1} onReferenceClick={onReferenceClick} />
              </div>
            ))}
          </div>

          <span>]</span>
        </span>
      );
    }

    case "dictionary": {
      if (value.entries.size === 0) {
        return <span className={styles.dictionary}>&lt;&lt; &gt;&gt;</span>;
      }

      return (
        <span className={styles.dictionary}>
          <span>&lt;&lt;</span>

          <div className={styles.nested} style={{ paddingLeft: 12 }}>
            {Array.from(value.entries).map(([key, entry]) => (
              <div key={key} className={styles.dictRow}>
                <span className={styles.dictKey}>/{key}</span>{" "}
                <PdfValue value={entry} depth={depth + 1} onReferenceClick={onReferenceClick} />
              </div>
            ))}
          </div>

          <span>&gt;&gt;</span>
        </span>
      );
    }
    case "stream": {
      return (
        <span className={styles.stream}>
          <div className={styles.streamDict}>
            <PdfValue
              value={value.dictionary}
              depth={depth + 1}
              onReferenceClick={onReferenceClick}
            />
          </div>
          <div className={styles.streamMeta}>
            stream: {value.data.length} bytes
            {value.data.length > 0 && (
              <span className={styles.streamPreview} title={bytesToHexPreview(value.data, 128)}>
                {" "}
                — {bytesToHexPreview(value.data, 16)}
                {value.data.length > 16 ? " ..." : ""}
              </span>
            )}
          </div>
        </span>
      );
    }

    default:
      return <span>—</span>;
  }
}
