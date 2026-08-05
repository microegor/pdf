import styles from "./Tabs.module.css";
import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { TabsContext } from "./TabsContext";
import { Tab, type TabProps } from "./Tab";

interface TabsProps {
  defaultValue?: string;
  children: ReactNode;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, onValueChange, children }: TabsProps) {
  const [iternalValue, setIternalValue] = useState(defaultValue);

  function setIternalValueEx(v: string | undefined) {
    if (v !== iternalValue) {
      setIternalValue(v);

      if (v && onValueChange) {
        onValueChange(v);
      }
    }
  }

  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> =>
      isValidElement<TabProps>(child) && child.type === Tab,
  );

  const activeTab = tabs.find((t) => t.props.value === iternalValue);

  return (
    <TabsContext value={{ value: iternalValue, setValue: setIternalValueEx }}>
      <div className={`${styles.tabs}`}>
        <div className={styles.tabsList}>
          {tabs.map((t, i) => (
            <Tab key={i} text={t.props.text} value={t.props.value} />
          ))}
        </div>
        <div className={styles.tabsContainer}>{activeTab && activeTab.props.children}</div>
      </div>
    </TabsContext>
  );
}
