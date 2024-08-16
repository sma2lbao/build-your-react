import {
  DefaultEventPriority,
  EventPriority,
} from "react-reconciler/react-event-priorities";
import { getEventPriority } from "./react-dom-event-listener";
import ReactDOMSharedInternals from "shared/react-dom-shared-internals";

export function resolveUpdatePriority(): EventPriority {
  const currentEvent = window.event;

  if (currentEvent === undefined) {
    return DefaultEventPriority;
  }

  return getEventPriority(currentEvent.type);
}

export function setCurrentUpdatePriority(newPriority: EventPriority): void {
  ReactDOMSharedInternals.p = newPriority;
}

export function getCurrentUpdatePriority(): EventPriority {
  return ReactDOMSharedInternals.p;
}
