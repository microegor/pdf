import styles from "./PdfObjectItem.module.css";

type PdfObjectItemProps = {
  objectNumber: number;
  generation: number;
  type: string;
  pdfType?: string | null;
  active?: boolean;
  onClick: () => void;
};

export function PdfObjectItem({
  objectNumber,
  generation,
  type,
  pdfType,
  active = false,
  onClick,
}: PdfObjectItemProps) {
  return (
    <button
      type="button"
      className={`${styles["pdf-object"]} ${active ? styles["pdf-object--active"] : ""}`}
      onClick={onClick}
    >
      <div className={styles["pdf-object__info"]}>
        <span className={styles["pdf-object__number"]}>
          {objectNumber} {generation} R
        </span>

        <span className={styles["pdf-object__type"]}>
          {type}
          {pdfType ? ` /${pdfType}` : ""}
        </span>
      </div>
    </button>
  );
}
