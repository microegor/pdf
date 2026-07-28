import '../style/App.css'

import type {
    MouseEvent as ReactMouseEvent,
    MouseEventHandler,
} from 'react';

interface ButtonProps {
    disabled?: boolean;
    size: ButtonSize;
    variant: Variant;
    text: string;
    onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

interface SwitcherProps {
    disabled?: boolean;
    onClick?: (isActive: boolean) => void;
    state: boolean;
}

type ButtonSize = 'big' | 'medium' | 'small';
type Variant = 'text' | 'contained' | 'outlined';

function onClick() {
    alert("aaaa")
}

function Button({
    disabled = false,
    size,
    variant,
    text,
    onClick,
}: ButtonProps) {
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

function Switch() {
}

function SwitcherButton({
    disabled = false,
    onClick,
    state
}: SwitcherProps) {
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

function App() {
    return (
        <div>
            <div>
                <Button
                    size="big"
                    variant="contained"
                    text="Button"
                    onClick={onClick}
                />
                <Button
                    disabled
                    size="big"
                    variant="contained"
                    text="Button"
                />
            </div>

            <div>
                <Button
                    size="big"
                    variant="outlined"
                    text="Button"
                />
                <Button
                    disabled
                    size="big"
                    variant="outlined"
                    text="Button"
                />
            </div>

            <div>
                <Button
                    size="big"
                    variant="text"
                    text="Button"
                />
                <Button
                    disabled
                    size="big"
                    variant="text"
                    text="Button"
                />
            </div>

            <div>
                <Button
                    size="big"
                    variant="contained"
                    text="Button"
                />
                <Button
                    size="medium"
                    variant="contained"
                    text="Button"
                />
                <Button
                    size="small"
                    variant="contained"
                    text="Button"
                />
            </div>
            <div>
                <SwitcherButton
                    disabled
                    onClick={Switch}
                    state
                />
                <SwitcherButton
                    onClick={Switch}
                    state = {false}
                />
            </div>
        </div>
    )
}

export default App