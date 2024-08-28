import { shouldSetTextContent } from "react-fiber-config";
import {
  cloneChildFibers,
  mountChildFibers,
  reconcileChildFibers,
} from "./react-child-fiber";
import { Lanes, NoLanes, includesSomeLane } from "./react-fiber-lane";
import { RootState } from "./react-fiber-root";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  ContextConsumer,
  ContextProvider,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  MemoComponent,
  SimpleMemoComponent,
} from "./react-work-tags";
import { pushHostContainer } from "./react-fiber-host-context";
import {
  cloneUpdateQueue,
  processUpdateQueue,
} from "./react-fiber-class-update-queue";
import {
  bailoutHooks,
  renderWithHooks,
  replaySuspendedComponentWithHooks,
} from "./react-fiber-hooks";
import { ContentReset, Ref } from "./react-fiber-flags";
import {
  createFiberFromTypeAndProps,
  createWorkInProgress,
  isSimpleFunctionComponent,
} from "./react-fiber";
import shallowEqual from "shared/shallow-equal";
import { markSkippedUpdateLanes } from "./react-fiber-work-loop";
import {
  prepareToReadContext,
  propagateContextChange,
  pushProvider,
  readContext,
} from "./react-fiber-new-context";
import { ReactConsumerType, ReactContext } from "shared/react-types";

let didReceiveUpdate: boolean = false;

/**
 * 处理 workInProgress Fiber任务，并获取下一个任务
 * @param current
 * @param workInProgress
 * @param renderLanes
 */
export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    // 更新或者 HostRoot
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (oldProps !== newProps) {
      didReceiveUpdate = true;
    } else {
      // props 相同

      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLanes
      );

      if (!hasScheduledUpdateOrContext) {
        // 没有相同的更新任务
        // 优化路径-防止重复渲染
        didReceiveUpdate = false;
        return attemptEarlyBailoutIfNoScheduledUpdate(
          current,
          workInProgress,
          renderLanes
        );
      }

      didReceiveUpdate = false;
    }
  } else {
    // 首次渲染
    didReceiveUpdate = false;
  }

  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case MemoComponent: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      return updateMemoComponent(
        current,
        workInProgress,
        type,
        unresolvedProps,
        renderLanes
      );
    }
    case SimpleMemoComponent: {
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      );
    }
    case FunctionComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;

      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        unresolvedProps,
        renderLanes
      );
    }
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes);
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  if (current === null) {
    // 首次渲染
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes
    );
  } else {
    // 更新
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes
    );
  }
}

export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}

function updateHostRoot(
  current: null | Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  // 将 container 保存到全局栈中-用于completeWork
  pushHostRootContext(workInProgress);

  if (current === null) {
    throw new Error("Should have a current fiber. This is a bug in React.");
  }

  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState;
  const prevChildren = prevState.element;
  cloneUpdateQueue(current, workInProgress);
  processUpdateQueue(workInProgress, nextProps, null, renderLanes);

  const nextState: RootState = workInProgress.memoizedState;
  const root: FiberRoot = workInProgress.stateNode;
  const nextChildren = nextState.element;

  if (nextChildren === prevChildren) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  prepareToReadContext(workInProgress, renderLanes);
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    null,
    renderLanes
  );

  if (current !== null && !didReceiveUpdate) {
    // 优化路径
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  let nextChildren = nextProps.children;
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

  if (isDirectTextChild) {
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    workInProgress.flags |= ContentReset;
  }

  markRef(current, workInProgress);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostText(current: null | Fiber, workInProgress: Fiber) {
  return null;
}

function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  if (current === null) {
    const type = Component.type;
    if (isSimpleFunctionComponent(type) && Component.compare === null) {
      let resolvedType = type;

      workInProgress.tag = SimpleMemoComponent;
      workInProgress.type = resolvedType;

      return updateSimpleMemoComponent(
        current,
        workInProgress,
        resolvedType,
        nextProps,
        renderLanes
      );
    }

    const child = createFiberFromTypeAndProps(
      Component.type,
      null,
      nextProps,
      workInProgress,
      workInProgress.mode,
      renderLanes
    );

    child.ref = workInProgress.ref;
    child.return = workInProgress;
    workInProgress.child = child;
    return child;
  }

  const currentChild = current.child as Fiber;
  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
    current,
    renderLanes
  );
  if (!hasScheduledUpdateOrContext) {
    const prevProps = currentChild.memoizedProps;
    let compare = Component.compare;
    compare = compare !== null ? compare : shallowEqual;
    if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  const newChild = createWorkInProgress(currentChild, nextProps);
  newChild.ref = workInProgress.ref;
  newChild.return = workInProgress;
  workInProgress.child = newChild;
  return newChild;
}

function updateSimpleMemoComponent(
  current: Fiber | null,
  worInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    const prevProps = current.memoizedProps;
    // 优化路径-减少重新渲染
    if (
      shallowEqual(prevProps, nextProps) &&
      current.ref === worInProgress.ref
    ) {
      didReceiveUpdate = false;

      worInProgress.pendingProps = nextProps = prevProps;

      if (!checkScheduledUpdateOrContext(current, renderLanes)) {
        worInProgress.lanes = current.lanes;
        return bailoutOnAlreadyFinishedWork(
          current,
          worInProgress,
          renderLanes
        );
      }
    }
  }

  return updateFunctionComponent(
    current,
    worInProgress,
    Component,
    nextProps,
    renderLanes
  );
}

function updateContextProvider(
  current: Fiber | null,
  worInProgress: Fiber,
  renderLanes: Lanes
) {
  const context = worInProgress.type;

  const newProps = worInProgress.pendingProps;
  const oldProps = worInProgress.memoizedProps;

  const newValue = newProps.value;

  pushProvider(worInProgress, context, newValue);
  if (oldProps !== null) {
    const oldValue = oldProps.value;
    if (Object.is(oldValue, newValue)) {
      if (oldProps.children === newProps.children) {
        return bailoutOnAlreadyFinishedWork(
          current,
          worInProgress,
          renderLanes
        );
      }
    } else {
      propagateContextChange(worInProgress, context, renderLanes);
    }
  }

  const newChildren = newProps.children;
  reconcileChildren(current, worInProgress, newChildren, renderLanes);
  return worInProgress.child;
}

function updateContextConsumer(
  current: Fiber | null,
  worInProgress: Fiber,
  renderLanes: Lanes
) {
  const consumerType: ReactConsumerType<any> = worInProgress.type;
  const context: ReactContext<any> = consumerType._context;
  const newProps = worInProgress.pendingProps;
  const render = newProps.children;

  prepareToReadContext(worInProgress, renderLanes);
  const newValue = readContext(context);
  let newChildren = render(newValue);

  reconcileChildren(current, worInProgress, newChildren, renderLanes);
  return worInProgress.child;
}

/**
 * 记录FiberRoot的container; 用于completeWork中获取container 创建 真实dom
 * @param workInProgress
 */
function pushHostRootContext(workInProgress: Fiber) {
  const root = workInProgress.stateNode as FiberRoot;

  pushHostContainer(root.containerInfo);
}

export function replayFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  nextProps: any,
  Component: any,
  renderLanes: Lanes
): Fiber | null {
  const nextChildren = replaySuspendedComponentWithHooks(
    current,
    workInProgress,
    Component,
    nextProps
  );

  // TODO
  // if (current !== null && !didReceiveUpdate) {
  //   bailoutHooks(current, workInProgress, renderLanes);
  //   return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  // }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function markRef(current: Fiber | null, workInProgress: Fiber) {
  const ref = workInProgress.ref;
  if (ref === null) {
    if (current !== null && current.ref !== null) {
      workInProgress.flags |= Ref;
    }
  } else {
    if (typeof ref !== "object") {
      throw new Error(
        "Expected ref to be an object returned by React.createRef(), or undefined/null."
      );
    }

    if (current === null || current.ref !== ref) {
      workInProgress.flags |= Ref;
    }
  }
}

/**
 * 用于检查当前的 Fiber 是否有与给定渲染优先级相匹配的更新。
 * 如果匹配，返回 true，否则返回 false。
 * 这种检查在 React 的调度和更新机制中非常重要，确保只处理必要的更新，从而提高性能。
 * @param current
 * @param renderLanes
 * @returns
 */
function checkScheduledUpdateOrContext(
  current: Fiber,
  renderLanes: Lanes
): boolean {
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) {
    return true;
  }

  return false;
}

/**
 * 优化路径-复用 context 的 dependencies；复制子fiber
 * @param current
 * @param workInProgress
 * @param renderLanes
 * @returns
 */
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    workInProgress.dependencies = current.dependencies;
  }
  debugger;

  markSkippedUpdateLanes(workInProgress.lanes);

  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    return null;
  }

  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  worInProgress: Fiber,
  renderLanes: Lanes
) {
  switch (worInProgress.tag) {
    case HostRoot:
      pushHostRootContext(worInProgress);
      // TODO
      break;
  }

  return bailoutOnAlreadyFinishedWork(current, worInProgress, renderLanes);
}
