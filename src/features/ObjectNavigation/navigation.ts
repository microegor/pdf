export type NavigableObject = {
  objectNumber: number;
  generation: number;
};

export type ObjectNavigationState<T extends NavigableObject> = {
  history: T[];
  historyIndex: number;
};

export function createObjectNavigationState<
  T extends NavigableObject,
>(): ObjectNavigationState<T> {
  return {
    history: [],
    historyIndex: -1,
  };
}

export function getCurrentObject<T extends NavigableObject>(
  state: ObjectNavigationState<T>,
): T | null {
  return state.history[state.historyIndex] ?? null;
}

export function startNavigation<T extends NavigableObject>(
  object: T,
): ObjectNavigationState<T> {
  return {
    history: [object],
    historyIndex: 0,
  };
}

export function followReference<T extends NavigableObject>(
  state: ObjectNavigationState<T>,
  object: T,
): ObjectNavigationState<T> {
  const history = [
    ...state.history.slice(0, state.historyIndex + 1),
    object,
  ];

  return {
    history,
    historyIndex: history.length - 1,
  };
}

export function selectHistoryItem<T extends NavigableObject>(
  state: ObjectNavigationState<T>,
  object: T,
): ObjectNavigationState<T> {
  const index = state.history.indexOf(object);

  if (index === -1) {
    return state;
  }

  return {
    ...state,
    historyIndex: index,
  };
}

export function findObjectByReference<T extends NavigableObject>(
  objects: readonly T[],
  objectNumber: number,
  generation: number,
): T | undefined {
  return objects.find(
    (object) =>
      object.objectNumber === objectNumber &&
      object.generation === generation,
  );
}