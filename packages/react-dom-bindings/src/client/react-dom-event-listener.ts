import {
  DefaultEventPriority,
  DiscreteEventPriority,
  EventPriority,
} from "react-reconciler/react-event-priorities";

export function getEventPriority(domEventName: string): EventPriority {
  switch (domEventName) {
    case "click":
      return DiscreteEventPriority;
    default:
      return DefaultEventPriority;
  }
}
