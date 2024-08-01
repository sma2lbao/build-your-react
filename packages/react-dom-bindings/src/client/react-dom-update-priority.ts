import {
  DefaultEventPriority,
  EventPriority,
} from "react-reconciler/react-event-priorities";
import { getEventPriority } from "./react-dom-event-listener";

export function resolveUpdatePriority(): EventPriority {
  const currentEvent = window.event;

  if (currentEvent === undefined) {
    return DefaultEventPriority;
  }

  return getEventPriority(currentEvent.type);
}
