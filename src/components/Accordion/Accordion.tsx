import type { ReactElement } from "react";

import styles from "./Accordion.module.css";
import {AccordionItem, type AccordionItemProps,} from "./AccordionItem";

type AccordionItemElement = ReactElement<
    AccordionItemProps,
    typeof AccordionItem
>;

type AccordionProps = {
    children: AccordionItemElement | AccordionItemElement[];
};

export function Accordion({ children }: AccordionProps) {
    return (
        <div className={styles.root}>
            {children}
        </div>
    );
}