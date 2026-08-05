import {
    useState,
    type PropsWithChildren,
    type ReactNode,
} from "react";

import styles from "./Accordion.module.css";



export type AccordionItemProps = PropsWithChildren<{
    value: string;
    title: ReactNode;
}>;

export function AccordionItem({
    title,
    children,
}: AccordionItemProps) {

    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={`${styles.AccordionItem}`}>
            <div className={`${styles.Title} ${isOpen ? styles.TitleOpen : ""}`} onClick={() => setIsOpen((previous) => !previous)}>
                {title}
            </div>
            <div
                className={`${styles.ContentWrapper} ${isOpen ? styles.ContentWrapperOpen : ""}`}>
                <div className={styles.Content}>
                    {children}
                </div>
            </div>
        </div>
    );
}