import {
  DefaultEventPriority,
  EventPriority,
} from "react-reconciler/react-event-priorities";
import ReactDOMSharedInternals from "shared/react-dom-shared-internals";
import { getEventPriority } from "../events/react-dom-event-listener";

export function resolveUpdatePriority(): EventPriority {
  const currentEvent = window.event;

  if (currentEvent === undefined) {
    return DefaultEventPriority;
  }

  return getEventPriority(currentEvent.type as any);
}

export function setCurrentUpdatePriority(newPriority: EventPriority): void {
  ReactDOMSharedInternals.p = newPriority;
}

export function getCurrentUpdatePriority(): EventPriority {
  return ReactDOMSharedInternals.p;
}
