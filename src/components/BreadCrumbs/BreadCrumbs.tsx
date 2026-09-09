import styles from "./BreadCrumbs.module.css";

type BreadcrumbsProps<T> = {
  items: readonly T[];
  activeItem: T | null;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
};

export function BreadCrumbs<T>({ items, activeItem, getLabel, onSelect }: BreadcrumbsProps<T>) {
  return (
    <nav aria-label="Navigation history">
      <ol className={styles.breadcrumbs}>
        {items.map((item, index) => {
          const isActive = item === activeItem;
          const isLast = index === items.length - 1;

          return (
            <li key={index} className={styles.item}>
              <button
                type="button"
                className={isActive ? styles.active : styles.link}
                onClick={() => onSelect(item)}
                aria-current={isActive ? "page" : undefined}
              >
                {getLabel(item)}
              </button>

              {!isLast && (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
