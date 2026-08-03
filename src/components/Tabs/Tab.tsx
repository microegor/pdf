import styles from "./Tabs.module.css";
import { useTabsContext } from "./TabsContext";

interface Tab {
    value: string;
    text: string;
}

export function Tab({ value, text }: Tab) {
    const tabs = useTabsContext();

    function handleClick() {
        tabs.setValue(value);
    }

    let active = '';
    if (value === tabs.value) {
        active = 'active'
    }
    // const active = tabs.value === value ? 'active' : '';

    return (
        <div className={`${styles.tab} ${active}`} onClick={handleClick}>{text}</div>
    )
}