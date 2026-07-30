import "./Button.module.css";

import type { MouseEvent as ReactMouseEvent } from "react";

interface ButtonProps {
  disabled?: boolean;
  size: ButtonSize;
  variant: Variant;
  text: string;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

type ButtonSize = "big" | "medium" | "small";
type Variant = "text" | "contained" | "outlined";

export function Button({ disabled = false, size, variant, text, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`button ${variant} ${size}`}
    >
      {text}
    </button>
  );
}
