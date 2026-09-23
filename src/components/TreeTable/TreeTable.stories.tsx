import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  TreeTable,
  type TreeTableColumn,
  type TreeTableRow,
} from "./TreeTable";

const columns: TreeTableColumn[] = [
  {
    id: "key",
    title: "Key",
    width: "minmax(180px, 1.2fr)",
  },
  {
    id: "type",
    title: "Type",
    width: "120px",
  },
  {
    id: "value",
    title: "Value",
    width: "minmax(180px, 2fr)",
  },
];

function InteractiveTreeTable() {
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedIds, setExpandedIds] = useState(
    () => new Set<string>(["catalog"]),
  );

  const isExpanded = (id: string) => expandedIds.has(id);

  const handleToggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const rows: TreeTableRow[] = [
    {
      id: "catalog",
      depth: 0,
      expandable: true,
      expanded: isExpanded("catalog"),
      cells: ["Catalog", "Dictionary", "4 entries"],
    },

    ...(isExpanded("catalog")
      ? [
          {
            id: "catalog/type",
            depth: 1,
            cells: ["Type", "Name", "/Catalog"],
          },
          {
            id: "catalog/pages",
            depth: 1,
            expandable: true,
            expanded: isExpanded("catalog/pages"),
            cells: ["Pages", "Dictionary", "3 entries"],
          },

          ...(isExpanded("catalog/pages")
            ? [
                {
                  id: "catalog/pages/count",
                  depth: 2,
                  cells: ["Count", "Integer", "12"],
                },
                {
                  id: "catalog/pages/kids",
                  depth: 2,
                  expandable: true,
                  expanded: isExpanded("catalog/pages/kids"),
                  cells: ["Kids", "Array", "2 items"],
                },

                ...(isExpanded("catalog/pages/kids")
                  ? [
                      {
                        id: "catalog/pages/kids/0",
                        depth: 3,
                        cells: ["0", "Reference", "3 0 R"],
                      },
                      {
                        id: "catalog/pages/kids/1",
                        depth: 3,
                        cells: ["1", "Reference", "4 0 R"],
                      },
                    ]
                  : []),
              ]
            : []),

          {
            id: "catalog/version",
            depth: 1,
            cells: ["Version", "Name", "/1.7"],
          },
          {
            id: "catalog/lang",
            depth: 1,
            cells: ["Lang", "String", "en-US"],
          },
        ]
      : []),

    {
      id: "info",
      depth: 0,
      expandable: true,
      expanded: isExpanded("info"),
      cells: ["Info", "Dictionary", "2 entries"],
    },

    ...(isExpanded("info")
      ? [
          {
            id: "info/producer",
            depth: 1,
            cells: ["Producer", "String", "Acrobat"],
          },
          {
            id: "info/creation-date",
            depth: 1,
            cells: ["CreationDate", "String", "D:20260923120000"],
          },
        ]
      : []),
  ];

  return (
    <TreeTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onToggle={handleToggle}
    />
  );
}

const meta = {
  title: "Components/TreeTable",
  component: TreeTable,
  parameters: {
    layout: "padded",
  },
  args: {
    columns,
    rows: [],
  },
} satisfies Meta<typeof TreeTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InteractiveTreeTable />,
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};

export const SelectedRow: Story = {
  args: {
    selectedId: "version",
    rows: [
      {
        id: "type",
        depth: 0,
        cells: ["Type", "Name", "/Catalog"],
      },
      {
        id: "version",
        depth: 0,
        cells: ["Version", "Name", "/1.7"],
      },
      {
        id: "pages",
        depth: 0,
        cells: ["Pages", "Reference", "2 0 R"],
      },
    ],
  },
};

export const DeepNesting: Story = {
  args: {
    rows: [
      {
        id: "0",
        depth: 0,
        cells: ["Level 0", "Dictionary", "1 entry"],
      },
      {
        id: "1",
        depth: 1,
        cells: ["Level 1", "Dictionary", "1 entry"],
      },
      {
        id: "2",
        depth: 2,
        cells: ["Level 2", "Dictionary", "1 entry"],
      },
      {
        id: "3",
        depth: 3,
        cells: ["Level 3", "Dictionary", "1 entry"],
      },
      {
        id: "4",
        depth: 4,
        cells: ["Level 4", "Dictionary", "1 entry"],
      },
      {
        id: "5",
        depth: 5,
        cells: ["Level 5", "String", "Maximum visual indentation"],
      },
    ],
  },
};