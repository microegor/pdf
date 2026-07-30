import type React from "react";
import "./Stack.module.css";

interface StackProps {
    direction?: direction;
    spacing?: number | string;
    children?: React.ReactNode;
    sx?: {
        /**
         * Default `stretch`
         */
        alignItems?: "center" | "flex-start" | "flex-end" | "stretch" | "baseline";
        justifyContent?:
        | "center"
        | "flex-start"
        | "flex-end"
        | "space-between"
        | "space-around"
        | "space-evenly";
    };
}

type direction = "row" | "column";

export function Stack({ direction = "column", spacing = 1, sx = {}, children }: StackProps) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: direction,
                gap: spacing,
                alignItems: sx.alignItems,
                justifyContent: sx.justifyContent,
            }}
        >
            {children}
        </div>
    );
}
