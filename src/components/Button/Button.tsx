import styles from "./Button.module.css";

import type { MouseEvent as ReactMouseEvent } from "react";

interface ButtonProps {
  disabled?: boolean;
  size?: ButtonSize;
  variant?: Variant;
  text: string;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

type ButtonSize = "big" | "medium" | "small";
type Variant = "text" | "contained" | "outlined";

export function Button({ disabled = false, size = "medium", variant = "contained", text, onClick }: ButtonProps) {
    return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
    >
      {text}
    </button>
  );
}
