import { createContext, useContext } from "react";

type TabsContextValue = {
    value: string | undefined;
    setValue: (value: string) => void;
};

export const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext() {
    const context = useContext(TabsContext);

    if (!context) {
        throw new Error('Tab must be used inside Tabs');
    }

    return context;
}
