import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs } from './Tabs';
import { Tab } from './Tab';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: "item1",
    children: null,
  },
  render: (props) => (
    <Tabs defaultValue={props.defaultValue} onValueChange={(value) => console.log(`Tab: ${value}`)}>
      <Tab value="item1" text="Item 1" />
      <Tab value="item2" text="Item 2" />
      <Tab value="item3" text="Item 3" />
    </Tabs>
  ),
};