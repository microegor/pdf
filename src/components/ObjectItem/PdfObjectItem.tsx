import styles from "./PdfObjectItem.module.css";

type PdfObjectItemProps = {
  objectNumber: number;
  generation: number;
  type: string;
  pdfType?: string | null;
  active?: boolean;
  onClick: () => void;
};

function getTypeSymbol(type: string) {
  const normalizedType = type.toLowerCase();

  // if (normalizedType === "dictionary" || normalizedType === "[d]") {
  //   return "{ }";
  // }

  // if (normalizedType === "string" || normalizedType === "s") {
  //   return '" "';
  // }

  return null;
}

export function PdfObjectItem({
  objectNumber,
  generation,
  type,
  pdfType,
  active = false,
  onClick,
}: PdfObjectItemProps) {
  const symbol = getTypeSymbol(type);

  return (
    <button
      type="button"
      className={`${styles["pdf-object"]} ${active ? styles["pdf-object--active"] : ""}`}
      onClick={onClick}
    >
      <div className={styles["pdf-object__info"]}>
        <div className={styles["pdf-object__main"]}>
          {symbol && <span className={styles["pdf-object__symbol"]}>{symbol}</span>}

          <span className={styles["pdf-object__number"]}>
            {objectNumber} {generation} R
          </span>
        </div>

        <span className={styles["pdf-object__type"]}>
          {type}
          {pdfType ? ` /${pdfType}` : ""}
        </span>
      </div>
    </button>
  );
}
