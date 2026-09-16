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
      className={`${styles["pdf-object"]} ${active ? styles["pdf-object--active"] : ""}`}
      onClick={onClick}
    >
      <div className={styles["pdf-object__info"]}>
        <div className={styles["pdf-object__main"]}>
          <span className={styles["pdf-object__number"]}>
            {objectNumber} {generation} R
          </span>
        </div>

        <span className={styles["pdf-object__type"]}>
          {type}
          {pdfType ? ` ${pdfType}` : ""}
        </span>
      </div>
    </button>
  );
}
