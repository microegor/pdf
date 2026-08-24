import type { PDFObject } from "../../reader";
import { PdfValue } from "../PdfValue";

type DictionaryObject = Extract<
  PDFObject,
  { type: "dictionary" }
>;

type Props = {
  value: DictionaryObject;
};

export function DictionaryView({ value }: Props) {
  return <PdfValue value={value} />;
}