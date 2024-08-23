import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  EventPriority,
} from "react-reconciler/react-event-priorities";
import { DOMEventName } from "./dom-event-names";
import { EventSystemFlags, IS_CAPTURE_PHASE } from "./event-system-flags";
import {
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from "../client/react-dom-update-priority";
import { AnyNativeEvent } from "./plugin-module-type";
import { dispatchEventForPluginEventSystem } from "./dom-plugin-event-system";
import { Fiber } from "react-reconciler/react-internal-types";
import { getNearestMountedFiber } from "react-reconciler/react-fiber-tree-reflection";
import { Container } from "../client/react-fiber-config-dom";
import getEventTarget from "./get-event-target";
import {
  getClosestInstanceFromNode,
  getInstanceFromNode,
} from "../client/react-dom-component-tree";
import { HostRoot } from "react-reconciler/react-work-tags";
import { isDiscreteEventThatRequiresHydration } from "./react-dom-event-replaying";

export let return_targetInst: Fiber | null = null;

/**
 * 创建事件监听器
 * @param targetContainer
 * @param domEventName
 * @param eventSystemFlags
 * @returns
 */
export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags
): Function {
  const eventPriority = getEventPriority(domEventName);
  let listenerWrapper;
  switch (eventPriority) {
    case DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent;
      break;
    case ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent;
      break;
    case DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent;
      break;
  }

  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  );
}

/**
 * 分发离散事件
 * @param domEventName
 * @param eventSystemFlags
 * @param container
 * @param nativeEvent 一般为 undefined
 */
function dispatchDiscreteEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority();
  try {
    setCurrentUpdatePriority(DiscreteEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
  }
}

/**
 * 分发连续性事件
 * @param domEventName
 * @param eventSystemFlags
 * @param container
 * @param nativeEvent
 */
function dispatchContinuousEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority();
  try {
    setCurrentUpdatePriority(ContinuousEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
  }
}

/**
 * 最终调度的事件处理器 （事件触发的入口）
 * @param domEventName 事件名称
 * @param eventSystemFlags 标记
 * @param targetContainer 事件容器
 * @param nativeEvent 原生事件对象 （转入）
 */
export function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  // 是否被阻塞
  let blockedOn = findInstanceBlockingEvent(nativeEvent);
  if (blockedOn === null) {
    // 没有阻塞
    dispatchEventForPluginEventSystem(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      return_targetInst,
      targetContainer
    );
    return;
  }

  if (
    eventSystemFlags & IS_CAPTURE_PHASE &&
    isDiscreteEventThatRequiresHydration(domEventName)
  ) {
    while (blockedOn !== null) {
      const fiber = getInstanceFromNode(blockedOn);
      if (fiber !== null) {
        // fast
      }
      const nextBlockedOn = findInstanceBlockingEvent(nativeEvent);
      if (nextBlockedOn === null) {
        dispatchEventForPluginEventSystem(
          domEventName,
          eventSystemFlags,
          nativeEvent,
          return_targetInst,
          targetContainer
        );
      }
      if (nextBlockedOn === blockedOn) {
        break;
      }
      blockedOn = nextBlockedOn;
    }

    if (blockedOn !== null) {
      nativeEvent.stopPropagation();
    }
    return;
  }

  dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    null,
    targetContainer
  );
}

/**
 * 通过原生事件获取 事件优先级
 * @param domEventName
 */
export function getEventPriority(domEventName: DOMEventName): EventPriority {
  switch (domEventName) {
    case "click":
    case "input":
    case "focus":
    case "change":
      return DiscreteEventPriority;
    default:
      return DefaultEventPriority;
  }
}

/**
 * 检查当前事件是否被某个组件阻塞
 * @param nativeEvent
 */
export function findInstanceBlockingEvent(
  nativeEvent: AnyNativeEvent
): null | Container {
  const nativeEventTarget = getEventTarget(nativeEvent);
  return findInstanceBlockingTarget(nativeEventTarget);
}

export function findInstanceBlockingTarget(targetNode: Node): null | Container {
  return_targetInst = null;

  let targetInst = getClosestInstanceFromNode(targetNode);
  if (targetInst !== null) {
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted === null) {
      targetInst = null;
    } else {
      const tag = nearestMounted.tag;
      if (tag === HostRoot) {
        targetInst = null;
      } else if (nearestMounted !== targetInst) {
        targetInst = null;
      }
    }
  }

  return_targetInst = targetInst;

  return null;
}
