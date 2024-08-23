import { DOMEventName } from "./dom-event-names";

export const allNativeEvents: Set<DOMEventName> = new Set();

/**
 * 注册捕获和冒泡两阶段的事件
 * @param registrationName eg. onClick
 * @param dependencies eg. ['click']
 */
export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
): void {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(registrationName + "Capture", dependencies);
}

export function registerDirectEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
) {
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i]);
  }
}
