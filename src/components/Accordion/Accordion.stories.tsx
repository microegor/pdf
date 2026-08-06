import type { Meta, StoryObj } from "@storybook/react-vite";

import { Accordion } from "./Accordion";
import { AccordionItem } from "./AccordionItem";

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: [
      <AccordionItem key="1" title="Item-1" value="item-1">
        Accordion
      </AccordionItem>,

      <AccordionItem key="2" title="Item-2" value="item-2">
        Accordion-2
      </AccordionItem>,
    ],
  },
};
