import { Children, type PropsWithChildren } from "react";

import styles from "ToggleButton.module.css";

type ToggleButtonProps = PropsWithChildren;

export function ToggleButton({ children }: ToggleButtonProps) {
    const buttons = Children.toArray(children);


    return (
        <div className={styles.toggleButton}>
            {buttons.map((button, index) => {
                const isFirst = index === 0;
                const isLast = index === buttons.length - 1;

                return (
                    <div
                        key={index}
                        className={
                            isFirst ? styles.first : isLast ? styles.last : styles.middle
                        }
                    >
                        {button}
                    </div>
                );
            })}
        </div>
    );
}