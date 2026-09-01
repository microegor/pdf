import { useState } from "react";

import type { PDFObject } from "../../reader";

import { BreadCrumbs } from "../../components/BreadCrumbs";
import { PdfValue } from "../../components/PdfValue";

type HistoryItem = {
  objectNumber: number;
  generation: number;
  value: PDFObject;
};

type Props = {
  initialObjectNumber: number;
  initialGeneration: number;
  initialValue: PDFObject;

  getObject: (objectNumber: number, generation: number) => PDFObject | undefined;
};

export function ObjectNavigation({
  initialObjectNumber,
  initialGeneration,
  initialValue,
  getObject,
}: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      objectNumber: initialObjectNumber,
      generation: initialGeneration,
      value: initialValue,
    },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const current = history[currentIndex];

  if (!current) {
    return null;
  }

  const handleReferenceClick = (objectNumber: number, generation: number) => {
    const value = getObject(objectNumber, generation);

    if (!value) {
      return;
    }

    const newHistory = history.slice(0, currentIndex + 1);

    newHistory.push({
      objectNumber,
      generation,
      value,
    });

    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleBreadCrumbClick = (id: string) => {
    const index = Number(id);

    if (Number.isNaN(index) || index < 0 || index >= history.length) {
      return;
    }

    setCurrentIndex(index);
  };

  const breadCrumbItems = history.map((item, index) => ({
    id: String(index),
    label: `${item.objectNumber} ${item.generation} R`,
  }));

  return (
    <div>
      <BreadCrumbs
        items={breadCrumbItems}
        activeId={String(currentIndex)}
        onSelect={handleBreadCrumbClick}
      />

      <PdfValue value={current.value} onReferenceClick={handleReferenceClick} />
    </div>
  );
}
