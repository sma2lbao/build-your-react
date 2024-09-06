import { ReactContext } from "shared/react-types";
import { ContextDependency, Fiber } from "./react-internal-types";
import { isPrimaryRenderer } from "react-fiber-config";
import {
  Lanes,
  NoLanes,
  includesSomeLane,
  isSubsetOfLanes,
  mergeLanes,
} from "./react-fiber-lane";
import { markWorkInProgressReceivedUpdate } from "./react-fiber-begin-work";
import { StackCursor, createCursor, pop, push } from "./react-fiber-stack";
import { ContextProvider } from "./react-work-tags";

const valueCursor: StackCursor<any> = createCursor(null);

let currentlyRenderingFiber: Fiber | null = null;
let lastContextDependency: ContextDependency<any> | null = null;
let lastFullyObservedContext: ReactContext<any> | null = null;

export function readContext<T>(context: ReactContext<T>): T {
  return readContextForConsumer(currentlyRenderingFiber, context);
}

function readContextForConsumer<T>(
  consumer: Fiber | null,
  context: ReactContext<T>
): T {
  const value = isPrimaryRenderer
    ? context._currentValue
    : context._currentValue2;

  if (lastFullyObservedContext === context) {
  } else {
    const contextItem = {
      context: context,
      memoizedValue: value,
      next: null,
    };

    if (lastContextDependency === null) {
      if (consumer === null) {
        throw new Error(
          "Context can only be read while React is rendering. " +
            "In classes, you can read it in the render method or getDerivedStateFromProps. " +
            "In function components, you can read it directly in the function body, but not " +
            "inside Hooks like useReducer() or useMemo()."
        );
      }

      lastContextDependency = contextItem;
      consumer.dependencies = {
        lanes: NoLanes,
        firstContext: contextItem,
      };
    } else {
      lastContextDependency = lastContextDependency.next = contextItem;
    }
  }
  return value;
}

export function readContextDuringReconciliation<T>(
  consumer: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): T {
  if (currentlyRenderingFiber === null) {
    prepareToReadContext(consumer, renderLanes);
  }
  return readContextForConsumer(consumer, context);
}

/**
 *  每次在beginWork中需要先重新定义 currentlyRenderingFiber 及其他全局遍历
 * @param workInProgress 流程中的fiber节点
 * @param renderLanes
 */
export function prepareToReadContext(
  workInProgress: Fiber,
  renderLanes: Lanes
): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;
  lastFullyObservedContext = null;

  const dependencies = workInProgress.dependencies;
  if (dependencies !== null) {
    const firstContext = dependencies.firstContext;
    if (firstContext !== null) {
      if (includesSomeLane(dependencies.lanes, renderLanes)) {
        markWorkInProgressReceivedUpdate();
      }

      dependencies.firstContext = null;
    }
  }
}

/**
 * current value 入栈
 * @param providerFiber
 * @param context
 * @param nextValue
 */
export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T
): void {
  if (isPrimaryRenderer) {
    push(valueCursor, context._currentValue);
    context._currentValue = nextValue;
  }
}

/**
 * value 出栈还原
 * @param context
 * @param providerFiber
 */
export function popProvider(
  context: ReactContext<any>,
  providerFiber: Fiber
): void {
  const currentValue = valueCursor.current;

  if (isPrimaryRenderer) {
    context._currentValue = currentValue;
  }

  pop(valueCursor);
}

export function propagateContextChange<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  propagateContextChange_eager(workInProgress, context, renderLanes);
}

function propagateContextChange_eager<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  let fiber = workInProgress.child;
  if (fiber !== null) {
    fiber.return = workInProgress;
  }
  while (fiber !== null) {
    let nextFiber;

    const list = fiber.dependencies;
    if (list !== null) {
      nextFiber = fiber.child;

      let dependency = list.firstContext;
      while (dependency !== null) {
        if (dependency.context === context) {
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
          const alternate = fiber.alternate;
          if (alternate !== null) {
            alternate.lanes = mergeLanes(alternate.lanes, renderLanes);
          }
          scheduleContextWorkOnParentPath(
            fiber.return,
            renderLanes,
            workInProgress
          );

          list.lanes = mergeLanes(list.lanes, renderLanes);

          break;
        }
        dependency = dependency.next;
      }
    } else if (fiber.tag === ContextProvider) {
      nextFiber = fiber.type === workInProgress.type ? null : fiber.child;
    } else {
      nextFiber = fiber.child;
    }

    if (nextFiber !== null) {
      nextFiber.return = fiber;
    } else {
      nextFiber = fiber;
      while (nextFiber !== null) {
        if (nextFiber === workInProgress) {
          nextFiber = null;
          break;
        }
        const sibling = nextFiber.sibling;
        if (sibling !== null) {
          sibling.return = nextFiber.return;
          nextFiber = sibling;
          break;
        }
        nextFiber = nextFiber.return;
      }
    }
    fiber = nextFiber;
  }
}

export function scheduleContextWorkOnParentPath(
  parent: Fiber | null,
  renderLanes: Lanes,
  propagationRoot: Fiber
) {
  let node = parent;
  while (node !== null) {
    const alternate = node.alternate;
    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
      node.childLanes = mergeLanes(node.childLanes, renderLanes);
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
      }
    } else if (
      alternate !== null &&
      !isSubsetOfLanes(alternate.childLanes, renderLanes)
    ) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
    } else {
    }
    if (node === propagationRoot) {
      break;
    }
    node = node.return;
  }
}
