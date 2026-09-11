import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { BreadCrumbs } from "./BreadCrumbs";

type BreadcrumbItem = {
  id: string;
  label: string;
};

const items: BreadcrumbItem[] = [
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
];

function BreadCrumbsStory(props: {
  items: readonly BreadcrumbItem[];
  activeItem: BreadcrumbItem | null;
  getLabel: (item: BreadcrumbItem) => string;
  onSelect: (item: BreadcrumbItem) => void;
}) {
  return <BreadCrumbs<BreadcrumbItem> {...props} />;
}

const meta = {
  title: "Components/Breadcrumbs",
  component: BreadCrumbsStory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  args: {
    items,
    activeItem: items[2],
    getLabel: (item: BreadcrumbItem) => item.label,
    onSelect: fn(),
  },
} satisfies Meta<typeof BreadCrumbsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
