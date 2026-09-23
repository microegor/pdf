import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type {
  PDFArray,
  PDFDictionary,
  PDFObject,
} from "../../reader";

import { PdfDictionaryTree } from "./DictionaryTree";

function object(value: unknown): PDFObject {
  return value as PDFObject;
}

function dictionary(
  entries: Array<[string, PDFObject]>,
): PDFDictionary {
  return {
    type: "dictionary",
    entries: new Map(entries),
  } as PDFDictionary;
}

function array(items: PDFObject[]): PDFArray {
  return {
    type: "array",
    items,
  } as PDFArray;
}

const sampleDictionary = dictionary([
  [
    "Type",
    object({
      type: "name",
      value: "Catalog",
    }),
  ],
  [
    "Version",
    object({
      type: "name",
      value: "1.7",
    }),
  ],
  [
    "PageCount",
    object({
      type: "number",
      value: 12,
    }),
  ],
  [
    "Scale",
    object({
      type: "number",
      value: 1.25,
    }),
  ],
  [
    "Title",
    object({
      type: "string",
      value: "Example PDF document",
    }),
  ],
  [
    "Linearized",
    object({
      type: "boolean",
      value: false,
    }),
  ],
  [
    "EmptyValue",
    object({
      type: "null",
    }),
  ],
  [
    "MediaBox",
    array([
      object({
        type: "number",
        value: 0,
      }),
      object({
        type: "number",
        value: 0,
      }),
      object({
        type: "number",
        value: 595,
      }),
      object({
        type: "number",
        value: 842,
      }),
    ]),
  ],
  [
    "ViewerPreferences",
    dictionary([
      [
        "HideToolbar",
        object({
          type: "boolean",
          value: true,
        }),
      ],
      [
        "Direction",
        object({
          type: "name",
          value: "L2R",
        }),
      ],
      [
        "PrintScaling",
        object({
          type: "name",
          value: "None",
        }),
      ],
    ]),
  ],
  [
    "Metadata",
    dictionary([
      [
        "Author",
        object({
          type: "string",
          value: "John Doe",
        }),
      ],
      [
        "Revision",
        object({
          type: "number",
          value: 3,
        }),
      ],
      [
        "Nested",
        dictionary([
          [
            "Level",
            object({
              type: "number",
              value: 3,
            }),
          ],
          [
            "Description",
            object({
              type: "string",
              value: "Nested PDF dictionary",
            }),
          ],
        ]),
      ],
    ]),
  ],
  [
    "ContentStream",
    object({
      type: "stream",
      data: new Uint8Array([
        0x42,
        0x54,
        0x20,
        0x2f,
        0x46,
        0x31,
        0x20,
        0x31,
        0x32,
        0x20,
        0x54,
        0x66,
      ]),
    }),
  ],
]);

const emptyDictionary = dictionary([]);

const meta = {
  title: "PDF/PdfDictionaryTree",
  component: PdfDictionaryTree,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PdfDictionaryTree>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: sampleDictionary,
  },
};

export const Empty: Story = {
  args: {
    value: emptyDictionary,
  },
};

export const Preselected: Story = {
  args: {
    value: sampleDictionary,
    selectedId: "/Title",
  },
};

export const Interactive: Story = {
  args: {
    value: sampleDictionary,
    onSelect: fn(),
    onReferenceClick: fn(),
  },
};