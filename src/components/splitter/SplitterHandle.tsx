import type {
    PointerEvent as ReactPointerEvent,
} from "react";

import styles from "./Splitter.module.css";

type Direction = "horizontal" | "vertical";

interface SplitterHandleProps {
    direction?: Direction;
    disabled?: boolean;
    onResize?: (delta: number) => void;
}

function getPosition(
    event: { clientX: number; clientY: number },
    direction: Direction,
) {
    return direction === "horizontal"
        ? event.clientX
        : event.clientY;
}

export function SplitterHandle({
    direction = "horizontal",
    disabled = false,
    onResize,
}: SplitterHandleProps) {
    const handlePointerDown = (
        event: ReactPointerEvent<HTMLDivElement>,
    ) => {
        if (disabled || event.button !== 0) {
            return;
        }

        event.preventDefault();

        const handle = event.currentTarget;

        let previousPosition = getPosition(
            event,
            direction,
        );

        const previousUserSelect =
            document.body.style.userSelect;

        const previousCursor =
            document.body.style.cursor;

        document.body.style.userSelect = "none";
        document.body.style.cursor =
            direction === "horizontal"
                ? "col-resize"
                : "row-resize";

        handle.classList.add(styles.dragging);

        const controller = new AbortController();

        const handlePointerMove = (
            moveEvent: globalThis.PointerEvent,
        ) => {
            const currentPosition = getPosition(
                moveEvent,
                direction,
            );

            const delta =
                currentPosition - previousPosition;

            previousPosition = currentPosition;

            onResize(delta);
        };

        const finishDragging = () => {
            controller.abort();

            document.body.style.userSelect =
                previousUserSelect;

            document.body.style.cursor =
                previousCursor;

            handle.classList.remove(styles.dragging);
        };

        window.addEventListener(
            "pointermove",
            handlePointerMove,
            {
                signal: controller.signal,
            },
        );

        window.addEventListener(
            "pointerup",
            finishDragging,
            {
                signal: controller.signal,
                once: true,
            },
        );

        window.addEventListener(
            "pointercancel",
            finishDragging,
            {
                signal: controller.signal,
                once: true,
            },
        );

        window.addEventListener(
            "blur",
            finishDragging,
            {
                signal: controller.signal,
                once: true,
            },
        );
    };

    return (
        <div
            className={[
                styles.handle,
                styles[direction],
                disabled ? styles.disabled : "",
            ]
                .filter(Boolean)
                .join(" ")}
            role="separator"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-orientation={
                direction === "horizontal"
                    ? "vertical"
                    : "horizontal"
            }
            onPointerDown={handlePointerDown}
        />
    );
}