import { Children, type ReactNode } from "react";
import styles from "./Splitter.module.css";

type Direction = "horizontal" | "vertical";

interface SplitterProps {
    children: ReactNode;
    direction?: Direction;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    step?: number;
    disabled?: boolean;
    onResize?: (newSize: number) => void;
}

export function Splitter({
    children,
    direction = "horizontal",
    defaultSize = 300,
    minSize = 100,
    maxSize = 700,
    step = 10,
    disabled = false,
    onResize,
}: SplitterProps) {
return (
    <div
            className={`${styles.splitter} ${styles[direction]}` }
        >
            {children}
            {/* <div
                className={styles.resizer}
                role="separator"
                aria-orientation={
                    direction === "horizontal" ? "vertical" : "horizontal"
                }
            /> */}
        </div>
    );
}