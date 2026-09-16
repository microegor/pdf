import type { PDFObject } from "../../reader";
import { PdfValue } from "../PdfValue";

type DictionaryObject = Extract<PDFObject, { type: "dictionary" }>;

type Props = {
  value: DictionaryObject;
  onReferenceClick?: (objectNumber: number, generation: number) => void;
};

export function DictionaryView({ value, onReferenceClick }: Props) {
  return (
    <section>
      <h3>Dictionary</h3>

      <hr />

      <PdfValue value={value} onReferenceClick={onReferenceClick} />
    </section>
  );
}