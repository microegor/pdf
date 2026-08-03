import {
    Children,
    type ReactNode,
    useState,
} from "react";

import { SplitterHandle } from "./SplitterHandle";
import styles from "./Splitter.module.css";

type Direction = "horizontal" | "vertical";

interface SplitterProps {
    children: ReactNode;
    direction?: Direction;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    disabled?: boolean;
    onResize?: (newSize: number) => void;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function Splitter({
    children,
    direction = "horizontal",
    defaultSize = 300,
    minSize = 100,
    maxSize = 700,
    disabled = false,
    onResize,
}: SplitterProps) {
    const panels = Children.toArray(children);

    const [size, setSize] = useState(() =>
        clamp(defaultSize, minSize, maxSize),
    );

    if (panels.length !== 2) {
        throw new Error(
            "Splitter должен содержать ровно две панели",
        );
    }

    const handleResize = (delta: number) => {
        setSize((currentSize) => {
            const newSize = clamp(
                currentSize + delta,
                minSize,
                maxSize,
            );

            onResize?.(newSize);

            return newSize;
        });
    };

    return (
        <div
            className={`${styles.splitter} ${styles[direction]}`}
        >
            <div
                className={styles.firstPanel}
                style={{
                    flexBasis: `${size}px`,
                }}
            >
                {panels[0]}
            </div>

            <SplitterHandle
                direction={direction}
                disabled={disabled}
                onResize={handleResize}
            />

            <div className={styles.secondPanel}>
                {panels[1]}
            </div>
        </div>
    );
}