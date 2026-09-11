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

type NavigationTarget<T extends NavigableObject> =
  | {
      type: "object";
      object: T;
    }
  | {
      type: "reference";
      objectNumber: number;
      generation: number;
    }
  | {
      type: "history";
      object: T;
    };

export function useObjectNavigation<T extends NavigableObject>(objects: readonly T[]) {
  const [state, setState] = useState<ObjectNavigationState<T>>(() =>
    createObjectNavigationState<T>(),
  );

  const currentObject = getCurrentObject(state);

  const navigate = useCallback(
    (target: NavigationTarget<T>) => {
      setState((currentState) => {
        switch (target.type) {
          case "object":
            return startNavigation(target.object);

          case "reference": {
            const object = findObjectByReference(objects, target.objectNumber, target.generation);

            if (!object) {
              console.warn(`Object ${target.objectNumber} ${target.generation} R not found`);

              return currentState;
            }

            return followReference(currentState, object);
          }

          case "history":
            return selectHistoryItem(currentState, target.object);
        }
      });
    },
    [objects],
  );

  const reset = useCallback(() => {
    setState(createObjectNavigationState<T>());
  }, []);

  return {
    currentObject,
    history: state.history,
    navigate,
    reset,
  };
}
