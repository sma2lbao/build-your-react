import { Fiber } from "react-reconciler/react-internal-types";
import { DOMEventName } from "../dom-event-names";
import {
  registerSimpleEvents,
  topLevelEventsToReactNames,
} from "../dom-event-properties";
import { EventSystemFlags, IS_CAPTURE_PHASE } from "../event-system-flags";
import { AnyNativeEvent } from "../plugin-module-type";
import {
  DispatchQueue,
  accumulateSinglePhaseListeners,
} from "../dom-plugin-event-system";
import { SyntheticEvent, SyntheticMouseEvent } from "../synthetic-event";
import { ReactSyntheticEvent } from "../react-synthetic-event-type";

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return;
  }

  let SyntheticEventCtor = SyntheticEvent;
  let reactEventType: string = domEventName;

  switch (domEventName) {
    case "click":
      if ((nativeEvent as any).button === 2) {
        return;
      }
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
    default:
      break;
  }

  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  const accumulateTargetOnly = false;
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent
  );

  if (listeners.length > 0) {
    const event: ReactSyntheticEvent = new SyntheticEventCtor(
      reactName,
      reactEventType,
      null,
      nativeEvent,
      nativeEventTarget
    );
    dispatchQueue.push({ event, listeners });
  }
}

export { registerSimpleEvents as registerEvents, extractEvents };
