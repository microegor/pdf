import styles from "./Switch.module.css";

interface SwitchProps {
  disabled?: boolean;
  onClick?: (isActive: boolean) => void;
  state?: boolean;
}

export function Switch({ disabled = false, onClick, state = false }: SwitchProps) {
  function handleClick() {
    onClick?.(!state);
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`${styles.switchButton} ${state ? styles.active : ""}`}
    />
  );
}
