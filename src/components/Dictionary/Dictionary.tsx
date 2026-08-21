import type { PDFObject } from "../../reader";

type DictionaryObject = Extract<
  PDFObject,
  { type: "dictionary" }
>;

type Props = {
  value: DictionaryObject;
};

function getEntryValue(entry: PDFObject) {
  if ("value" in entry) {
    return String(entry.value);
  }

  return "";
}

export function DictionaryView({ value }: Props) {
  return (
    <div>
      {Array.from(value.entries).map(([key, entry]) => (
        <div key={key}>
          <strong>/{key}</strong>{" "}
          <span>{getEntryValue(entry)}</span>
        </div>
      ))}
    </div>
  );
}