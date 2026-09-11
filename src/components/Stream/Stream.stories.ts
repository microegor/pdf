import type { Meta, StoryObj } from "@storybook/react-vite";

import { fn } from "storybook/test";

import type { PDFObject } from "../../reader";
import {
  createDictionary,
  createNumber,
  createStream,
  createReference,
  createName,
} from "../../reader";

import { StreamView } from "./Stream";

const textData = new TextEncoder().encode("Hello from PDF stream!\nThis is decoded text.");

const textStream = createStream(
  createDictionary(new Map<string, PDFObject>([["Length", createNumber(textData.length)]])),
  textData,
);

const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xaa, 0xbb]);

const binaryStream = createStream(
  createDictionary(
    new Map<string, PDFObject>([
      ["Length", createNumber(binaryData.length)],
      ["Page", createReference(1, 0)],
      ["Name", createName("Hello")],
      ["NameCyrillic", createName("Привет")],
    ]),
  ),
  binaryData,
);

const meta = {
  title: "Components/StreamView",
  component: StreamView,

  parameters: {
    layout: "padded",
  },

  tags: ["autodocs"],

  argTypes: {
    value: {
      control: false,
    },
  },

  args: {
    value: textStream,
    onReferenceClick: fn(),
  },
} satisfies Meta<typeof StreamView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Binary: Story = {
  args: {
    value: binaryStream,
  },
};
