import { Children, type PropsWithChildren } from "react";

import styles from ToggleButton.module.css;

type ToggleButtonProps = PropsWithChildren;

export function ToggleButton({ children }: ToggleButtonProps) {
    const buttons = Children.toArray(children);

    return (
        <div>
            {buttons.map((button, index) => (
                <div key={index}>{button}</div>
            ))}
        </div>
    );
}