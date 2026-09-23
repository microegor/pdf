import type { PDFDictionary } from "../../reader";
import { PdfDictionaryTree } from "./DictionaryTree";

type Props = {
  value: PDFDictionary;
  onReferenceClick?: (objectNumber: number, generation: number) => void;
};

export function DictionaryView({ value, onReferenceClick }: Props) {
  return (
    <section>
      <h3>Dictionary</h3>

      <PdfDictionaryTree value={value} onReferenceClick={onReferenceClick} />
    </section>
  );
}
