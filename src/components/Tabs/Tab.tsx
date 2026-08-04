import styles from "./Tabs.module.css";
import { useTabsContext } from "./TabsContext";

interface TabProps {
    value: string;
    text: string;
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