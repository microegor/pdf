import type React from "react";

interface StackProps {
  direction?: Direction;
  spacing?: number | string;
  children?: React.ReactNode;

  sx?: {
    alignItems?: "center" | "flex-start" | "flex-end" | "stretch" | "baseline";

    justifyContent?:
      | "center"
      | "flex-start"
      | "flex-end"
      | "space-between"
      | "space-around"
      | "space-evenly";

    width?: string | number;
    height?: string | number;
    flex?: string | number;
    minHeight?: string | number;

    overflow?: React.CSSProperties["overflow"];
    border?: React.CSSProperties["border"];
  };
}

type Direction = "row" | "column";

export function Stack({
  direction = "column",
  spacing = 1,
  sx = {},
  children,
}: StackProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: spacing,

        alignItems: sx.alignItems,
        justifyContent: sx.justifyContent,

        width: sx.width,
        height: sx.height,
        flex: sx.flex,
        minHeight: sx.minHeight,

        overflow: sx.overflow,
        border: sx.border,
      }}
    >
      {children}
    </div>
  );
}