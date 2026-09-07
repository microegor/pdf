import { useCallback, useState } from "react";

import {
  createObjectNavigationState,
  findObjectByReference,
  followReference,
  getCurrentObject,
  selectHistoryItem,
  startNavigation,
  type NavigableObject,
  type ObjectNavigationState,
} from "./navigation";

export function useObjectNavigation<T extends NavigableObject>(
  objects: readonly T[],
) {
  const [state, setState] = useState<ObjectNavigationState<T>>(() =>
    createObjectNavigationState<T>(),
  );

  const currentObject = getCurrentObject(state);

  const openObject = useCallback((object: T) => {
    setState({
      ...startNavigation(object),
      
  });
  }, []);

  const openReference = useCallback(
    (objectNumber: number, generation: number) => {
      const target = findObjectByReference(
        objects,
        objectNumber,
        generation,
      );

      if (!target) {
        console.warn(
          `Object ${objectNumber} ${generation} R not found`,
        );
        return;
      }

      setState((currentState) =>
        followReference(currentState, target),
      );
    },
    [objects],
  );

  const goToHistoryItem = useCallback((index: number) => {
    setState((currentState) =>
      selectHistoryItem(currentState, index),
    );
  }, []);

  const reset = useCallback(() => {
    setState(createObjectNavigationState<T>());
  }, []);

  return {
    currentObject,
    history: state.history,
    historyIndex: state.historyIndex,
    openObject,
    openReference,
    goToHistoryItem,
    reset,
  };
}