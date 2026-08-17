import type { PropsWithChildren } from "react";

import styles from "./ToggleButton.module.css";

type TButtonProps = PropsWithChildren<{
    onClick?: () => void;
}>;

export function ToggleButton({ children}: TButtonProps) {
    return(<button className={styles.toggleButton}>{children}</button>)
}
