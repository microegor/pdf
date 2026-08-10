import {
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { TreeContext } from "./TreeContext";

type TreeContainerProps = PropsWithChildren<{
  defaultSelectedKey?: string | null;
}>;

export function TreeContainer({
  defaultSelectedKey = null,
  children,
}: TreeContainerProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    defaultSelectedKey,
  );

  const contextValue = useMemo(
    () => ({
      selectedKey,
      select: (key: string) => {
        setSelectedKey(key);
      },
    }),
    [selectedKey],
  );

  return (
    <TreeContext.Provider value={contextValue}>
      <div role="tree">
        {children}
      </div>
    </TreeContext.Provider>
  );
}