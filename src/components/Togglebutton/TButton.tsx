import type { PropsWithChildren } from "react";

type TButtonProps = PropsWithChildren<{
    onClick?: () => void;
}>;

export function TButton({ children}: TButtonProps) {
    <button>{children}</button>
}