import type { Meta, StoryObj } from "@storybook/react-vite";

import { Preloader } from "./Preloader";

const meta = {
  title: "Components/Preloader",
  component: Preloader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Preloader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: [
      <AcordionItem
        key="item-1"
        value = "item-1"
        title = "First"
      >
      Content 1
      </AcordionItem>,

      < AcordionItem
        key = "item-2"
        value = "item-2"
        title = "Second"
      >
      Content 2
      </AcordionItem>,

      < AcordionItem
        key = "item-3"
        value = "item-3"
        title = "Third"
      >
      Content 3
      </AcordionItem>,
    ],
  },
};