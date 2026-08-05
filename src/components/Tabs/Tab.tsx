import type { ReactNode } from "react";
import styles from "./Tabs.module.css";
import { useTabsContext } from "./TabsContext";

export interface TabProps {
    value: string;
    text: string;
    children?: ReactNode;
}

export function Tab({ value, text }: TabProps) {
    const tabs = useTabsContext();

    const isActive = tabs.value === value;

    return (
        <div
            className={`${styles.tab} ${isActive ? styles.active : ""}`}
            onClick={() => tabs.setValue(value)}
        >   
            {text}
        </div>
    );
}