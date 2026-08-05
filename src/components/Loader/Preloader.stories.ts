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

};