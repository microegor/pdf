import { BreadCrumbs } from "../../components/BreadCrumbs";
import { PdfValue } from "../../components/PdfValue";
import type { PDFObject } from "../../reader";

type NavigationObject = {
  objectNumber: number;
  generation: number;
  value: PDFObject;
};

type Props<T extends NavigationObject> = {
  currentObject: T;
  history: readonly T[];

  onReferenceClick: (
    objectNumber: number,
    generation: number,
  ) => void;

  onHistoryItemClick: (object: T) => void;
};

export function ObjectNavigation<T extends NavigationObject>({
  currentObject,
  history,
  onReferenceClick,
  onHistoryItemClick,
}: Props<T>) {
  return (
    <div>
      <BreadCrumbs
        items={history}
        activeItem={currentObject}
        getLabel={(item) =>
          `${item.objectNumber} ${item.generation} R`
        }
        onSelect={onHistoryItemClick}
      />

      <PdfValue
        value={currentObject.value}
        onReferenceClick={onReferenceClick}
      />
    </div>
  );
}