import { BreadCrumbs } from "../../components/BreadCrumbs";
import { PdfValue } from "../../components/PdfValue";
import type { PDFObject } from "../../reader";

type HistoryItem = {
  objectNumber: number;
  generation: number;
};

type Props = {
  currentObject: {
    objectNumber: number;
    generation: number;
    value: PDFObject;
  };

  history: HistoryItem[];
  historyIndex: number;

  onReferenceClick: (
    objectNumber: number,
    generation: number,
  ) => void;

  onHistoryItemClick: (index: number) => void;
};

export function ObjectNavigation({
  currentObject,
  history,
  historyIndex,
  onReferenceClick,
  onHistoryItemClick,
}: Props) {
  const breadCrumbItems = history.map((item, index) => ({
    id: String(index),
    label: `${item.objectNumber} ${item.generation} R`,
  }));

  return (
    <div>
      <BreadCrumbs
        items={breadCrumbItems}
        activeId={String(historyIndex)}
        onSelect={(id) => onHistoryItemClick(Number(id))}
      />

      <PdfValue
        value={currentObject.value}
        onReferenceClick={onReferenceClick}
      />
    </div>
  );
}