import styles from "./BreadCrumbs.module.css";

export type BreadcrumbItem = {
  id: string;
  label: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function BreadCrumbs({ items, activeId, onSelect }: BreadcrumbsProps) {
  return (
    <nav aria-label="Navigation history">
      <ol className={styles.breadcrumbs}>
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const isLast = index === items.length - 1;

          return (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                className={isActive ? styles.active : styles.link}
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
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
