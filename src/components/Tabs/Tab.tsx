import {
  forwardRef,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

import styles from "./Tabs.module.css";
import { useTabsContext } from "./TabsContext";

export interface TabProps {
  value: string;
  text: string;
  children?: ReactNode;

  id?: string;
  panelId?: string;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  function Tab(
    {
      value,
      text,
      id,
      panelId,
      tabIndex,
      onKeyDown,
    },
    ref,
  ) {
    const tabs = useTabsContext();

    const isActive = tabs.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={id}
        aria-selected={isActive}
        aria-controls={panelId}
        tabIndex={tabIndex}
        className={`${styles.tab} ${isActive ? styles.active : ""}`}
        onClick={() => tabs.setValue(value)}
        onKeyDown={onKeyDown}
      >
        {text}
      </button>
    );
  },
);