import { createContext, useContext } from "react";

type TreeContextValue = {
  selectedKey: string | null;
  select: (key: string) => void;
};

export const TreeContext = createContext<TreeContextValue | null>(null);

export function useTreeContext() {
  const context = useContext(TreeContext);

  if (context === null) {
    throw new Error("useTreeContext must be used inside TreeContainer");
  }

  return context;
}
