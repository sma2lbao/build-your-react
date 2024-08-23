import { DOMEventName } from "./dom-event-names";

const discreteReplayableEvents: Array<DOMEventName> = ["click", "input"];

export function isDiscreteEventThatRequiresHydration(
  eventType: DOMEventName
): boolean {
  return discreteReplayableEvents.indexOf(eventType) > -1;
}
