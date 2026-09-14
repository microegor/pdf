import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import styles from "./DropeZone.module.css";

interface DropZoneProps {
  accept?: string;
  onChange?: (file: File | null) => void;
  disabled?: boolean;
}

export const DropZone = ({
  accept,
  onChange,
  disabled = false,
}: DropZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | null) => {
    if (!file) {
      return;
    }

    onChange?.(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;

    handleFile(file);
  };

  const handleDragOver = (
    event: DragEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setIsDragging(true);
  };

  const handleDragLeave = (
    event: DragEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();

    setIsDragging(false);
  };

  const handleDrop = (
    event: DragEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] ?? null;

    handleFile(file);
  };

  return (
    <>
      <button
        type="button"
        className={`
          ${styles.dropZone}
          ${isDragging ? styles.dragging : ""}
          ${disabled ? styles.disabled : ""}
        `}
        disabled={disabled}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className={styles.text}>
          Перетащите файл сюда
        </span>

        <span className={styles.subText}>
          или нажмите для выбора
        </span>
      </button>

      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleInputChange}
      />
    </>
  );
};