import { Fiber } from "react-reconciler/react-internal-types";
import { COMMENT_NODE, DOCUMENT_NODE } from "../client/html-node-type";
import { DOMEventName } from "./dom-event-names";
import { allNativeEvents } from "./event-registry";
import {
  EventSystemFlags,
  IS_CAPTURE_PHASE,
  IS_NON_DELEGATED,
  IS_EVENT_HANDLE_NON_MANAGED_NODE,
} from "./event-system-flags";
import { AnyNativeEvent } from "./plugin-module-type";
import { createEventListenerWrapperWithPriority } from "./react-dom-event-listener";
import {
  addEventBubbleListener,
  addEventCaptureListener,
} from "./event-listener";
import {
  HostComponent,
  HostRoot,
  HostText,
} from "react-reconciler/react-work-tags";
import { getClosestInstanceFromNode } from "../client/react-dom-component-tree";
import * as SimpleEventPlugin from "./plugins/simple-event-plugin";
import getEventTarget from "./get-event-target";
import { batchedUpdates } from "./react-dom-update-batching";
import { ReactSyntheticEvent } from "./react-synthetic-event-type";
import getListener from "./get-listener";

type DispatchListener = {
  instance: Fiber | null;
  listener: Function;
  currentTarget: EventTarget;
};

type DispatchEntry = {
  event: ReactSyntheticEvent;
  listeners: Array<DispatchListener>;
};

export type DispatchQueue = Array<DispatchEntry>;

const listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);

SimpleEventPlugin.registerEvents();

/**
 * 非委托事件
 */
export const nonDelegatedEvents: Set<DOMEventName> = new Set([]);

/**
 * 事件委托入口
 * @param rootContainerElement
 */
export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  if (!(rootContainerElement as any)[listeningMarker]) {
    (rootContainerElement as any)[listeningMarker] = true;

    allNativeEvents.forEach((domEventName) => {
      if (!nonDelegatedEvents.has(domEventName)) {
        listenToNativeEvent(domEventName, false, rootContainerElement);
      }
      listenToNativeEvent(domEventName, true, rootContainerElement);
    });

    // 找到document对象打标记
    const ownerDocument =
      (rootContainerElement as any).nodeType === DOCUMENT_NODE
        ? rootContainerElement
        : (rootContainerElement as any).ownerDocument;

    if (ownerDocument !== null) {
      if (!ownerDocument[listeningMarker]) {
        ownerDocument[listeningMarker] = true;
      }
    }
  }
}

/**
 * 监听原生事件
 * @param domEventName
 * @param isCapturePhaseListener 是否捕获阶段监听器
 * @param target
 */
export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget
): void {
  let eventSystemFlags = 0;
  // 捕获阶段
  if (isCapturePhaseListener) {
    eventSystemFlags |= IS_CAPTURE_PHASE;
  }

  addTrappedEventListener(
    target,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
  );
}

/**
 * 添加监听器
 * @param targetContainer
 * @param domEventName
 * @param eventSystemFlags
 * @param isCapturePhaseListener
 */
function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean
) {
  // 带有事件优先级的监听器
  const listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );

  let unsubscribeListener;
  if (isCapturePhaseListener) {
    // 增加捕获阶段监听器
    unsubscribeListener = addEventCaptureListener(
      targetContainer,
      domEventName,
      listener
    );
  } else {
    // 增加冒泡阶段监听器
    unsubscribeListener = addEventBubbleListener(
      targetContainer,
      domEventName,
      listener
    );
  }
}

export function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget
): void {
  let ancestorInst = targetInst;

  if (
    (eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
    (eventSystemFlags && IS_NON_DELEGATED) === 0
  ) {
    // 没有 IS_EVENT_HANDLE_NON_MANAGED_NODE 及 IS_NON_DELEGATED 标记
    const targetContainerNode = targetContainer as Node;

    if (targetInst !== null) {
      let node: null | Fiber = targetInst;

      mainLoop: while (true) {
        if (node === null) {
          return;
        }

        const nodeTag = node.tag;
        if (nodeTag === HostRoot) {
          let container = node.stateNode.containerInfo as Element;
          if (isMatchingRootContainer(container, targetContainerNode)) {
            break;
          }

          while (container !== null) {
            const parentNode = getClosestInstanceFromNode(container);
            if (parentNode === null) {
              return;
            }
            const parentTag = parentNode.tag;
            if (parentTag === HostComponent || parentTag === HostText) {
              node = ancestorInst = parentNode;
              continue mainLoop;
            }
            container = container.parentNode as Element;
          }
        }
        node = node.return;
      }
    }
  }

  batchedUpdates(() =>
    dispatchEventsForPlugins(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      ancestorInst,
      targetContainer
    )
  );
}

function dispatchEventsForPlugins(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: Fiber | null,
  targetContainer: EventTarget
): void {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const dispatchQueue: DispatchQueue = [];
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

/**
 * 提取事件
 * @param dispatchQueue
 * @param domEventName
 * @param targetInst
 * @param nativeEvent
 * @param nativeEventTarget
 * @param eventSystemFlags
 * @param targetContainer
 */
function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: Fiber | null,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget | null,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
) {
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );
}

/**
 * 执行回调函数
 * @param dispatchQueue
 * @param eventSystemFlags
 */
export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags
): void {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i];

    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
  }
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean
): void {
  let previousInstance;
  if (inCapturePhase) {
    // 捕获阶段倒序遍历
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  } else {
    // 冒泡阶段正序遍历
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + "Capture" : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  let listenners: Array<DispatchListener> = [];

  let instance = targetFiber;
  let lastHostComponent = null;

  while (instance !== null) {
    const { stateNode, tag } = instance;
    if (tag === HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      if (reactEventName !== null) {
        // 从 HostComponent Fiber节点的 props 获取监听器
        const listener = getListener(instance, reactEventName);
        if (listener != null) {
          listenners.push(
            createDispatchListener(instance, listener, lastHostComponent)
          );
        }
      }
    }

    if (accumulateTargetOnly) {
      break;
    }
    instance = instance.return;
  }

  return listenners;
}

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget
): void {
  event.currentTarget = currentTarget;
  try {
    listener(event);
  } catch (error) {
    throw new Error(`reportGlobalError`);
  }
  event.currentTarget = null;
}

function createDispatchListener(
  instance: Fiber | null,
  listener: Function,
  currentTarget: EventTarget
): DispatchListener {
  return {
    instance,
    listener,
    currentTarget,
  };
}

function isMatchingRootContainer(
  grandContainer: Element,
  targetContainer: EventTarget
): boolean {
  return (
    grandContainer === targetContainer ||
    (grandContainer.nodeType === COMMENT_NODE &&
      grandContainer.parentNode === targetContainer)
  );
}
