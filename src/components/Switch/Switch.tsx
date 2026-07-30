import './Switch.module.css'

import type {
    MouseEvent as ReactMouseEvent,
} from 'react';


interface SwitchProps {
    disabled?: boolean;
    onClick?: (isActive: boolean) => void;
    state: boolean;
}

export function Switch({
    disabled = false,
    onClick,
    state
}: SwitchProps) {
    function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
        const button = event.currentTarget;

        const isActive = button.classList.toggle('active');

        button.setAttribute('aria-checked', String(isActive));

        onClick?.(isActive);
    }
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={handleClick}
            className={`switchButton ${state ? 'active' : ''}`}
        />
    );
}
