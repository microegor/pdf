import type { PDFObject } from "../../reader";
import { DictionaryView } from "../Dictionary";

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

      <DictionaryView value={value.dictionary} />
    </div>
  );
}