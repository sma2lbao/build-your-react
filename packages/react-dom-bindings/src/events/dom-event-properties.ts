import { DOMEventName } from "./dom-event-names";
import { registerTwoPhaseEvent } from "./event-registry";

export const topLevelEventsToReactNames: Map<DOMEventName, string | null> =
  new Map();

const simpleEventPluginEvents = ["click", "input"];

export function registerSimpleEvents() {
  for (let i = 0; i < simpleEventPluginEvents.length; i++) {
    const eventName = simpleEventPluginEvents[i];
    const domEventName = eventName.toLowerCase() as DOMEventName;
    // 举例 click -> Click
    const capitalizedEvent = eventName[0].toUpperCase() + eventName.slice(1);
    registerSimpleEvent(domEventName, "on" + capitalizedEvent);
  }
}

/**
 * 注册事件
 * @param domEventName  eg. click
 * @param reactName eg. onClick
 */
function registerSimpleEvent(domEventName: DOMEventName, reactName: string) {
  topLevelEventsToReactNames.set(domEventName, reactName);
  registerTwoPhaseEvent(reactName, [domEventName]);
}
