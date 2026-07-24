import '../style/App.css'

interface ButtonProps {
    disabled?: boolean;
    size: ButtonSize;
    variant: Variants;
    text: string;
}

function onClick() {

}

type ButtonSize = 'big' | 'medium' | 'small';
type Variants = 'text' | 'contained' | 'outlined';

function Button({ disabled, size, variant, text }: ButtonProps) {

    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={`${disabled ? 'disabled-button' : 'button'} ${variant} ${size}`}
        >
            {text}
        </button>
    )
}

function App() {
    return (
        <div>
            <div>
                <Button
                    size="big"
                    variant="contained"
                    text="Button"
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
        </div>
    )
}

export default App