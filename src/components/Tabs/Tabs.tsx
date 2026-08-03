import styles from "./Tabs.module.css";
import { useState, type ReactNode } from "react";
import { TabsContext } from "./TabsContext";

interface TabsProps {
    defaultValue?: string;
    children: ReactNode;
    onValueChange?: (value: string) => void;
}

export function Tabs({defaultValue, onValueChange, children }: TabsProps) {
    const [iternalValue, setIternalValue] = useState(defaultValue);

    function setIternalValueEx(v: string | undefined) {
        if (v !== iternalValue) {
            setIternalValue(v);
            
            if (v && onValueChange) {
                onValueChange(v);
            }
        }
    }

    return (
        <TabsContext value={{value: iternalValue, setValue: setIternalValueEx}}>
            <div className={`${styles.tabs}`}>
                {children}
            </div>
        </TabsContext>
    )
} 