import type { ReactNode } from "react";
import styles from "./Splitter.module.css";


interface SplitterPanelProps {
    children?: ReactNode;
    className?: string;
}

export function SplitterPanel({
    children,
    className,
}: SplitterPanelProps) {
    return (
        <div
            className={`${styles.panel} ${className ?? ""}`}
        >
            {children}
        </div>
    );
}