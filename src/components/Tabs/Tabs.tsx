import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import styles from "./Tabs.module.css";
import { TabsContext } from "./TabsContext";
import { Tab, type TabProps } from "./Tab";

interface TabsProps {
  defaultValue?: string;
  children: ReactNode;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, onValueChange, children }: TabsProps) {
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> =>
      isValidElement<TabProps>(child) && child.type === Tab,
  );

  const [internalValue, setInternalValue] = useState(defaultValue ?? tabs[0]?.props.value);

  const tabsId = useId();

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function setInternalValueEx(value: string) {
    if (value === internalValue) {
      return;
    }

    setInternalValue(value);
    onValueChange?.(value);
  }

  function selectTab(index: number) {
    const tab = tabs[index];

    if (!tab) {
      return;
    }

    setInternalValueEx(tab.props.value);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (tabs.length === 0) {
      return;
    }

    let nextIndex: number | undefined;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;

      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = tabs.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();
    selectTab(nextIndex);
  }

  const activeIndex = tabs.findIndex((tab) => tab.props.value === internalValue);

  const activeTab = activeIndex >= 0 ? tabs[activeIndex] : undefined;

  const activeTabId = activeIndex >= 0 ? `${tabsId}-tab-${activeIndex}` : undefined;

  const activePanelId = activeIndex >= 0 ? `${tabsId}-panel-${activeIndex}` : undefined;

  return (
    <TabsContext
      value={{
        value: internalValue,
        setValue: setInternalValueEx,
      }}
    >
      <div className={styles.tabs}>
        <div className={styles.tabsList} role="tablist">
          {tabs.map((tab, index) => {
            const tabId = `${tabsId}-tab-${index}`;
            const panelId = `${tabsId}-panel-${index}`;
            const isActive = tab.props.value === internalValue;

            return (
              <Tab
                key={tab.props.value}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                text={tab.props.text}
                value={tab.props.value}
                id={tabId}
                panelId={panelId}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => handleKeyDown(event, index)}
              />
            );
          })}
        </div>

        {activeTab && (
          <div
            id={activePanelId}
            role="tabpanel"
            aria-labelledby={activeTabId}
            className={styles.tabsContainer}
          >
            {activeTab.props.children}
          </div>
        )}
      </div>
    </TabsContext>
  );
}
