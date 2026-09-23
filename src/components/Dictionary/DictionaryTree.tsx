import { useEffect, useState, type ReactNode } from "react";

import type { PDFArray, PDFDictionary, PDFObject } from "../../reader";
import { PdfValue } from "../PdfValue";
import { TreeTable, type TreeTableColumn, type TreeTableRow } from "../TreeTable";
import styles from "./Dictionary.module.css";

type Props = {
  value: PDFDictionary;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onReferenceClick?: (objectNumber: number, generation: number) => void;
};

const columns: TreeTableColumn[] = [
  {
    id: "key",
    title: "Key",
    width: "minmax(180px, 1.2fr)",
  },
  {
    id: "type",
    title: "Type",
    width: "120px",
  },
  {
    id: "value",
    title: "Value",
    width: "minmax(180px, 2fr)",
  },
];

function escapePathSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function createRowId(parentId: string, segment: string): string {
  return `${parentId}/${escapePathSegment(segment)}`;
}

function getTypeLabel(value: PDFObject): string {
  switch (value.type) {
    case "dictionary":
      return "Dictionary";

    case "array":
      return "Array";

    case "name":
      return "Name";

    case "number":
      return Number.isInteger(value.value) ? "Integer" : "Real";

    case "string":
      return "String";

    case "hexstring":
      return "Hex String";

    case "boolean":
      return "Boolean";

    case "null":
      return "Null";

    case "reference":
      return "Reference";

    case "stream":
      return "Stream";
  }
}

function getContainerEntries(value: PDFDictionary | PDFArray): Array<[string, PDFObject]> {
  if (value.type === "dictionary") {
    return Array.from(value.entries.entries());
  }

  return value.items.map<[string, PDFObject]>((item, index) => [String(index), item]);
}

function isExpandable(value: PDFObject): value is PDFDictionary | PDFArray {
  if (value.type === "dictionary") {
    return value.entries.size > 0;
  }

  if (value.type === "array") {
    return value.items.length > 0;
  }

  return false;
}

function getValueCell(
  value: PDFObject,
  onReferenceClick?: (objectNumber: number, generation: number) => void,
): ReactNode {
  switch (value.type) {
    case "dictionary":
      return (
        <span className={styles.summary}>
          {value.entries.size} {value.entries.size === 1 ? "entry" : "entries"}
        </span>
      );

    case "array":
      return (
        <span className={styles.summary}>
          {value.items.length} {value.items.length === 1 ? "item" : "items"}
        </span>
      );

    case "stream":
      return (
        <span className={styles.summary}>
          {value.data.length} {value.data.length === 1 ? "byte" : "bytes"}
        </span>
      );

    default:
      return <PdfValue value={value} onReferenceClick={onReferenceClick} />;
  }
}

function buildRows(
  value: PDFDictionary | PDFArray,
  expandedIds: Set<string>,
  onReferenceClick: Props["onReferenceClick"],
  parentId = "",
  depth = 0,
): TreeTableRow[] {
  const rows: TreeTableRow[] = [];

  for (const [key, entry] of getContainerEntries(value)) {
    const id = createRowId(parentId, key);

    const expandable = isExpandable(entry);
    const expanded = expandable && expandedIds.has(id);

    rows.push({
      id,
      depth,
      expandable,
      expanded,
      cells: [
        key,

        <span key={`${id}:type`} className={styles.typeBadge}>
          {getTypeLabel(entry)}
        </span>,

        getValueCell(entry, onReferenceClick),
      ],
    });

    if (expanded && isExpandable(entry)) {
      rows.push(...buildRows(entry, expandedIds, onReferenceClick, id, depth + 1));
    }
  }

  return rows;
}

export function PdfDictionaryTree({ value, selectedId, onSelect, onReferenceClick }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set<string>());

  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setExpandedIds(new Set<string>());
    setInternalSelectedId(undefined);
  }, [value]);

  const rows = buildRows(value, expandedIds, onReferenceClick);

  const activeSelectedId = selectedId ?? internalSelectedId;

  const handleToggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const handleSelect = (id: string) => {
    setInternalSelectedId(id);
    onSelect?.(id);
  };

  return (
    <TreeTable
      columns={columns}
      rows={rows}
      selectedId={activeSelectedId}
      onSelect={handleSelect}
      onToggle={handleToggle}
    />
  );
}
