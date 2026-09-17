import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import styles from "./TreeTable.module.css";

export type TreeTableColumn = {
  id: string;
  title: ReactNode;
  width: string;
};

export type TreeTableRow = {
  id: string;
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  cells: ReactNode[];
};

type Props = {
  columns: TreeTableColumn[];
  rows: TreeTableRow[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
};

const INDENT_SIZE = 16;
const MAX_VISUAL_DEPTH = 4;

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ""}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TreeTable({ columns, rows, selectedId, onSelect, onToggle }: Props) {
  const gridTemplateColumns = columns.map((column) => column.width).join(" ");

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: TreeTableRow) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(row.id);
      return;
    }

    if (!row.expandable) {
      return;
    }

    if (event.key === "ArrowRight" && !row.expanded) {
      event.preventDefault();
      onToggle?.(row.id);
    }

    if (event.key === "ArrowLeft" && row.expanded) {
      event.preventDefault();
      onToggle?.(row.id);
    }
  };

  return (
    <div className={styles.table} role="treegrid" aria-colcount={columns.length}>
      <div className={styles.header} role="row" style={{ gridTemplateColumns }}>
        {columns.map((column) => (
          <div key={column.id} className={styles.headerCell} role="columnheader">
            {column.title}
          </div>
        ))}
      </div>

      <div role="rowgroup">
        {rows.map((row) => {
          const isSelected = selectedId === row.id;
          const visualDepth = Math.min(row.depth, MAX_VISUAL_DEPTH);

          return (
            <div
              key={row.id}
              className={`${styles.row} ${isSelected ? styles.selected : ""}`}
              role="row"
              aria-level={row.depth + 1}
              aria-selected={isSelected}
              aria-expanded={row.expandable ? Boolean(row.expanded) : undefined}
              tabIndex={0}
              style={{ gridTemplateColumns }}
              onClick={() => onSelect?.(row.id)}
              onKeyDown={(event) => handleRowKeyDown(event, row)}
            >
              {columns.map((column, index) => {
                const cell = row.cells[index] ?? null;

                if (index === 0) {
                  return (
                    <div
                      key={column.id}
                      className={`${styles.cell} ${styles.firstCell}`}
                      role="gridcell"
                      style={{
                        paddingInlineStart: 12 + visualDepth * INDENT_SIZE,
                      }}
                    >
                      {row.expandable ? (
                        <button
                          type="button"
                          className={styles.toggle}
                          aria-label={row.expanded ? "Collapse row" : "Expand row"}
                          aria-expanded={Boolean(row.expanded)}
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            onToggle?.(row.id);
                          }}
                        >
                          <Chevron expanded={Boolean(row.expanded)} />
                        </button>
                      ) : (
                        <span className={styles.togglePlaceholder} aria-hidden="true" />
                      )}

                      <div className={styles.cellContent}>{cell}</div>
                    </div>
                  );
                }

                return (
                  <div key={column.id} className={styles.cell} role="gridcell">
                    <div className={styles.cellContent}>{cell}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}