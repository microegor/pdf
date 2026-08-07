import type { PropsWithChildren } from "react";

import styles from "./ToggleButton.module.css";

type TButtonProps = PropsWithChildren<{
    onClick?: () => void;
}>;

export function TButton({ children}: TButtonProps) {
    return(<button className={styles.tButton}>{children}</button>)
}