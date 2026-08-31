import { useState, type PropsWithChildren, type ReactNode } from "react";

import styles from "./Accordion.module.css";

export type AccordionItemProps = PropsWithChildren<{
  value: string;
  title: ReactNode;
  disabled?: boolean;
  Open?: boolean;
}>;

export function AccordionItem({
  disabled = false,
  title,
  children,
  Open = false,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(Open);

  return (
    <div className={styles.accordionItem}>
      <button
        type="button"
        disabled={disabled}
        className={`${styles.title} ${isOpen ? styles.titleOpen : ""}`}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-expanded={isOpen}
      >
        {title}
      </button>

      <div className={`${styles.contentWrapper} ${isOpen ? styles.contentWrapperOpen : ""}`}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
