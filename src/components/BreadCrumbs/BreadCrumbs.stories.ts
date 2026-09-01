import type { Meta, StoryObj } from "@storybook/react-vite";

import { fn } from "storybook/test";

import { BreadCrumbs } from "./BreadCrumbs";

const meta = {
  title: "Components/Breadcrumbs",
  component: BreadCrumbs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onSelect: fn(),
  },
} satisfies Meta<typeof BreadCrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      {
        id: "home",
        label: "Главная",
      },
      {
        id: "users",
        label: "Пользователи",
      },
      {
        id: "user-25",
        label: "User #25",
      },
      {
        id: "settings",
        label: "Настройки",
      },
    ],
    activeId: "user-25",
  },
};
