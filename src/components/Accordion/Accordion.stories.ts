import type { Meta, StoryObj } from "@storybook/react-vite";

import { Accordion } from "./Accordion";

const meta = {
  title: "Components/Acordion",
  component: Accordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
