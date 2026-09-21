import styles from "./PdfObjectItem.module.css";

type PdfObjectItemProps = {
  objectNumber: number;
  generation: number;
  type: string;
  pdfType?: string | null;
  active?: boolean;
  tabIndex?: number;
  onClick: () => void;
};

function renderTypeIcon(type: string) {
  return (
    <span className={styles["pdfObject_type"]}>
      <span
        className={`${styles["pdfObject_kind"]} ${type === "D"
          ? styles["pdfObject_kind-dictionary"]
          : type === "S"
            ? styles["pdfObject_kind-stream"]
            : ""
          }`}
      >
        {type}
      </span>
    </span>
  );
}

export function PdfObjectItem({
  objectNumber,
  generation,
  type,
  pdfType,
  active = false,
  tabIndex = 0,
  onClick,
}: PdfObjectItemProps) {
  return (
    <button
      type="button"
      data-pdf-object-item
      tabIndex={tabIndex}
      className={`${styles["pdfObject"]} ${active ? styles["pdfObject-active"] : ""
        }`}
      onClick={onClick}
    >
      <div className={styles["pdfObject_info"]}>
        <div className={styles["pdfObject_main"]}>
          <span className={styles["pdfObject_number"]}>
            {objectNumber} {generation} R
          </span>
        </div>

        <span className={styles["pdfObject_type"]}>
          {renderTypeIcon(type)}
          {pdfType && <span>{pdfType}</span>}
        </span>
      </div>
    </button>
  );
}