type BaseSyntheticEvent = {
  isPersistent: () => boolean;
  isPropagationStopped: () => boolean;

  nativeEvent: Event;
  target?: any;
  relatedTarget?: any;
  type: string;
  currentTarget: null | EventTarget;
};

export type KnowReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: string;
};

export type UnKnowReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: null;
};

export type ReactSyntheticEvent =
  | KnowReactSyntheticEvent
  | UnKnowReactSyntheticEvent;
