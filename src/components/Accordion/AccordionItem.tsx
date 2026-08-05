import { useState, type PropsWithChildren, type ReactNode } from "react";

import styles from "./Accordion.module.css";

export type AccordionItemProps = PropsWithChildren<{
  value: string;
  title: ReactNode;
}>;

export function AccordionItem({ title, children }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`${styles.accordionItem}`}>
      <div
        className={`${styles.title} ${isOpen ? styles.titleOpen : ""}`}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {title}
      </div>
      <div className={`${styles.contentWrapper} ${isOpen ? styles.contentWrapperOpen : ""}`}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
