import type { PDFObject } from "../../reader";
import { PdfValue } from "../PdfValue";

type StreamObject = Extract<
  PDFObject,
  { type: "stream" }
>;

type Props = {
  value: StreamObject;
};

export function StreamView({ value }: Props) {
  return (
    <div>
      <h3>Stream</h3>
      <PdfValue value={value} />
    </div>
  );
}