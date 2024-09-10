import { shouldSetTextContent } from "react-fiber-config";
import {
  cloneChildFibers,
  mountChildFibers,
  reconcileChildFibers,
} from "./react-child-fiber";
import {
  Lanes,
  NoLane,
  NoLanes,
  OffscreenLane,
  includesSomeLane,
  laneToLanes,
  mergeLanes,
  removeLanes,
} from "./react-fiber-lane";
import { RootState } from "./react-fiber-root";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  ContextConsumer,
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  LazyComponent,
  MemoComponent,
  OffscreenComponent,
  SimpleMemoComponent,
  SuspenseComponent,
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
import {
  ChildDeletion,
  ContentReset,
  DidCapture,
  DidDefer,
  NoFlags,
  Placement,
  Ref,
  StaticMask,
} from "./react-fiber-flags";
import {
  createFiberFromFragment,
  createFiberFromOffscreen,
  createFiberFromTypeAndProps,
  createWorkInProgress,
  isSimpleFunctionComponent,
} from "./react-fiber";
import shallowEqual from "shared/shallow-equal";
import {
  markSkippedUpdateLanes,
  peekDeferredLane,
} from "./react-fiber-work-loop";
import {
  prepareToReadContext,
  propagateContextChange,
  pushProvider,
  readContext,
} from "./react-fiber-new-context";
import { ReactConsumerType, ReactContext } from "shared/react-types";
import {
  OffscreenDetached,
  OffscreenProps,
  OffscreenState,
} from "./react-fiber-activity-component";
import {
  pushHiddenContext,
  reuseHiddenContextOnStack,
} from "./react-fiber-hidden-context";
import { LazyComponent as LazyComponentType } from "react/react-lazy";
import { SuspenseState } from "./react-fiber-suspense-component";
import {
  ForceSuspenseFallback,
  hasSuspenseListContext,
  pushFallbackTreeSuspenseHandler,
  pushOffscreenSuspenseHandler,
  pushPrimaryTreeSuspenseHandler,
  suspenseStackCursor,
} from "./react-fiber-suspense-context";

let didReceiveUpdate: boolean = false;

const SUSPENDED_MARKER: SuspenseState = {
  retryLane: NoLane,
};

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
    case LazyComponent: {
      const elementType = workInProgress.elementType;
      return mountLazyComponent(
        current,
        workInProgress,
        elementType,
        renderLanes
      );
    }
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
    case Fragment:
      return updateFragment(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
    case SuspenseComponent:
      return updateSuspenseComponent(current, workInProgress, renderLanes);
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes);
    case OffscreenComponent: {
      return updateOffscreenComponent(current, workInProgress, renderLanes);
    }
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

function updateSuspenseComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const nextProps = workInProgress.pendingProps;

  let showFallback = false;
  const didSuspend = (workInProgress.flags & DidCapture) !== NoFlags;
  if (
    didSuspend ||
    shouldRemainOnFallback(current, workInProgress, renderLanes)
  ) {
    showFallback = true;
    workInProgress.flags &= ~DidCapture;
  }

  const didPrimaryChildrenDefer = (workInProgress.flags & DidDefer) !== NoFlags;
  workInProgress.flags &= ~DidDefer;

  if (current === null) {
    const nextPrimaryChildren = nextProps.children;
    const nextFallbackChildren = nextProps.fallback;

    if (showFallback) {
      pushFallbackTreeSuspenseHandler(workInProgress);

      const fallbackFragment = mountSuspenseFallbackChildren(
        workInProgress,
        nextPrimaryChildren,
        nextFallbackChildren,
        renderLanes
      );
      const primaryChildFragment = workInProgress.child as Fiber;
      primaryChildFragment.memoizedState = {
        cachePool: null,
        baseLanes: renderLanes,
      } as OffscreenState;
      primaryChildFragment.childLanes = getRemainingWorkInPrimaryTree(
        current,
        didPrimaryChildrenDefer,
        renderLanes
      );
      workInProgress.memoizedState = SUSPENDED_MARKER;

      return fallbackFragment;
    } else {
      pushPrimaryTreeSuspenseHandler(workInProgress);
      return mountSuspensePrimaryChildren(
        workInProgress,
        nextPrimaryChildren,
        renderLanes
      );
    }
  } else {
    // 更新
    if (showFallback) {
      pushFallbackTreeSuspenseHandler(workInProgress);

      const nextFallbackChildren = nextProps.fallback;
      const nextPrimaryChildren = nextProps.children;
      const fallbackChildFragment = updateSuspenseFallbackChildren(
        current,
        workInProgress,
        nextPrimaryChildren,
        nextFallbackChildren,
        renderLanes
      );
      const primaryChildFragment = workInProgress.child as Fiber;
      const prevOffscreenState = current.child!
        .memoizedState as OffscreenState | null;
      primaryChildFragment.memoizedState = {
        baseLanes:
          prevOffscreenState === null
            ? renderLanes
            : mergeLanes(prevOffscreenState.baseLanes, renderLanes),
        cachePool: null,
      } as OffscreenState;

      primaryChildFragment.childLanes = getRemainingWorkInPrimaryTree(
        current,
        didPrimaryChildrenDefer,
        renderLanes
      );
      workInProgress.memoizedState = SUSPENDED_MARKER;
      return fallbackChildFragment;
    } else {
      pushPrimaryTreeSuspenseHandler(workInProgress);

      const nextPrimaryChildren = nextProps.children;
      const primaryChildFragment = updateSuspensePrimaryChildren(
        current,
        workInProgress,
        nextPrimaryChildren,
        renderLanes
      );
      workInProgress.memoizedState = null;
      return primaryChildFragment;
    }
  }
}

function mountSuspenseFallbackChildren(
  workInProgress: Fiber,
  primaryChildren: any,
  fallbackChildren: any,
  renderLanes: Lanes
) {
  const mode = workInProgress.mode;
  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };

  const primaryChildFragment = createFiberFromOffscreen(
    primaryChildProps,
    mode,
    NoLanes,
    null
  );
  const fallbackChildFragment = createFiberFromFragment(
    fallbackChildren,
    mode,
    renderLanes,
    null
  );

  primaryChildFragment.return = workInProgress;
  fallbackChildFragment.return = workInProgress;
  primaryChildFragment.sibling = fallbackChildFragment;
  workInProgress.child = primaryChildFragment;
  return fallbackChildFragment;
}

function updateSuspenseFallbackChildren(
  current: Fiber,
  workInProgress: Fiber,
  primaryChildren: any,
  fallbackChildren: any,
  renderLanes: Lanes
) {
  const mode = workInProgress.mode;
  const currentPrimaryChildFragment = current.child!;
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };
  // 复用 current 的 Offscreen 组件
  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );
  primaryChildFragment.subtreeFlags =
    currentPrimaryChildFragment.subtreeFlags & StaticMask;

  let fallbackChildFragment;
  if (currentFallbackChildFragment !== null) {
    // 复用
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    // 用 Fragment 包裹
    fallbackChildFragment = createFiberFromFragment(
      fallbackChildren,
      mode,
      renderLanes,
      null
    );
    fallbackChildFragment.flags |= Placement;
  }

  fallbackChildFragment.return = workInProgress;
  primaryChildFragment.return = workInProgress;
  primaryChildFragment.sibling = fallbackChildFragment;
  workInProgress.child = primaryChildFragment;

  return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(
  workInProgress: Fiber,
  primaryChildren: any,
  renderLanes: Lanes
) {
  const mode = workInProgress.mode;
  const primaryChildProps: OffscreenProps = {
    mode: "visible",
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(
    primaryChildProps,
    mode,
    renderLanes,
    null
  );
  primaryChildFragment.return = workInProgress;
  workInProgress.child = primaryChildFragment;
  return primaryChildFragment;
}

function updateSuspensePrimaryChildren(
  current: Fiber,
  workInProgress: Fiber,
  primaryChildren: any,
  renderLanes: Lanes
) {
  const currentPrimaryChildFragment = current.child!;
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    {
      mode: "visible",
      children: primaryChildren,
    }
  );
  primaryChildFragment.return = workInProgress;
  primaryChildFragment.sibling = null;
  if (currentFallbackChildFragment !== null) {
    const deletions = workInProgress.deletions;
    if (deletions === null) {
      workInProgress.deletions = [currentFallbackChildFragment];
      workInProgress.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }

  workInProgress.child = primaryChildFragment;
  return primaryChildFragment;
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
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    const prevProps = current.memoizedProps;
    // 优化路径-减少重新渲染
    if (
      shallowEqual(prevProps, nextProps) &&
      current.ref === workInProgress.ref
    ) {
      didReceiveUpdate = false;

      workInProgress.pendingProps = nextProps = prevProps;

      if (!checkScheduledUpdateOrContext(current, renderLanes)) {
        workInProgress.lanes = current.lanes;
        return bailoutOnAlreadyFinishedWork(
          current,
          workInProgress,
          renderLanes
        );
      }
    }
  }

  return updateFunctionComponent(
    current,
    workInProgress,
    Component,
    nextProps,
    renderLanes
  );
}

function updateContextProvider(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const context = workInProgress.type;

  const newProps = workInProgress.pendingProps;
  const oldProps = workInProgress.memoizedProps;

  const newValue = newProps.value;

  pushProvider(workInProgress, context, newValue);
  if (oldProps !== null) {
    const oldValue = oldProps.value;
    if (Object.is(oldValue, newValue)) {
      if (oldProps.children === newProps.children) {
        return bailoutOnAlreadyFinishedWork(
          current,
          workInProgress,
          renderLanes
        );
      }
    } else {
      propagateContextChange(workInProgress, context, renderLanes);
    }
  }

  const newChildren = newProps.children;
  reconcileChildren(current, workInProgress, newChildren, renderLanes);
  return workInProgress.child;
}

function updateContextConsumer(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const consumerType: ReactConsumerType<any> = workInProgress.type;
  const context: ReactContext<any> = consumerType._context;
  const newProps = workInProgress.pendingProps;
  const render = newProps.children;

  prepareToReadContext(workInProgress, renderLanes);
  const newValue = readContext(context);
  let newChildren = render(newValue);

  reconcileChildren(current, workInProgress, newChildren, renderLanes);
  return workInProgress.child;
}

function updateFragment(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const nextChildren = workInProgress.pendingProps;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateOffscreenComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const nextProps: OffscreenProps = workInProgress.pendingProps;
  const nextChildren = nextProps.children;
  const nextIsDetached =
    (workInProgress.stateNode._pendingVisibility & OffscreenDetached) !== 0;
  const prevState: OffscreenState | null =
    current !== null ? current.memoizedState : null;

  markRef(current, workInProgress);

  if (nextProps.mode === "hidden" || nextIsDetached) {
    // 渲染隐藏树
    if (!includesSomeLane(renderLanes, OffscreenLane)) {
      // TODO 挂起
      workInProgress.lanes = workInProgress.childLanes =
        laneToLanes(OffscreenLane);

      const nextBaseLanes =
        prevState !== null
          ? mergeLanes(prevState.baseLanes, renderLanes)
          : renderLanes;

      return deferHiddenOffscreenComponent(
        current,
        workInProgress,
        nextBaseLanes,
        renderLanes
      );
    } else {
      const nextState: OffscreenState = {
        baseLanes: NoLanes,
        cachePool: null,
      };
      workInProgress.memoizedState = nextState;

      if (prevState !== null) {
        pushHiddenContext(workInProgress, prevState);
      } else {
        reuseHiddenContextOnStack(workInProgress);
      }
      pushOffscreenSuspenseHandler(workInProgress);
    }
  } else {
    // 渲染可见树
    if (prevState !== null) {
      // 从 hidden -> visible

      pushHiddenContext(workInProgress, prevState);
      reuseHiddenContextOnStack(workInProgress);

      workInProgress.memoizedState = null;
    } else {
      // 一直是可见，没有变化
      reuseHiddenContextOnStack(workInProgress);
    }
  }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function deferHiddenOffscreenComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  nextBaseLanes: Lanes,
  renderLanes: Lanes
) {
  const nextState: OffscreenState = {
    baseLanes: nextBaseLanes,
    cachePool: null,
  };
  workInProgress.memoizedState = nextState;

  reuseHiddenContextOnStack(workInProgress);
  pushOffscreenSuspenseHandler(workInProgress);
  return null;
}

/**
 * 获取 suspense 的真实子组件的优先级
 */
function getRemainingWorkInPrimaryTree(
  current: Fiber | null,
  primaryTreeDidDefer: boolean,
  renderLanes: Lanes
) {
  let remainingLanes =
    current !== null ? removeLanes(current.childLanes, renderLanes) : NoLanes;
  if (primaryTreeDidDefer) {
    // 一个useDeferredValue钩子在主树中生成一个延迟的任务。确保我们以延迟的优先级重试该组件。
    remainingLanes = mergeLanes(remainingLanes, peekDeferredLane());
  }
  return remainingLanes;
}

function mountLazyComponent(
  _current: Fiber | null,
  workInProgress: Fiber,
  elementType: any,
  renderLanes: Lanes
) {
  const props = workInProgress.pendingProps;
  const lazyComponent: LazyComponentType<any, any> = elementType;
  const payload = lazyComponent._payload;
  const init = lazyComponent._init;
  const Component = init(payload);
  workInProgress.type = Component;

  if (typeof Component === "function") {
    // 已解析并返回函数组件
    workInProgress.tag = FunctionComponent;
    return updateFunctionComponent(
      null,
      workInProgress,
      Component,
      props,
      renderLanes
    );
  }
  throw new Error(
    `Element type is invalid. Received a promise that resolves to: ${Component}. ` +
      `Lazy element type must resolve to a class or function.`
  );
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

  markSkippedUpdateLanes(workInProgress.lanes);

  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    return null;
  }

  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  switch (workInProgress.tag) {
    case HostRoot:
      pushHostRootContext(workInProgress);
      // TODO
      break;
    case SuspenseComponent: {
      const state: SuspenseState | null = workInProgress.memoizedState;
      if (state !== null) {
        const primaryChildFragment = workInProgress.child!;
        const primaryChildLanes = primaryChildFragment.childLanes;
        if (includesSomeLane(renderLanes, primaryChildLanes)) {
          // 子进程有待处理的工作。使用正常路径尝试再次渲染主要子节点。
          return updateSuspenseComponent(current, workInProgress, renderLanes);
        } else {
          pushPrimaryTreeSuspenseHandler(workInProgress);
          const child = bailoutOnAlreadyFinishedWork(
            current,
            workInProgress,
            renderLanes
          );
          if (child !== null) {
            return child.sibling;
          } else {
            return null;
          }
        }
      } else {
        pushPrimaryTreeSuspenseHandler(workInProgress);
      }
      break;
    }
    case OffscreenComponent: {
      workInProgress.lanes = NoLanes;
      return updateOffscreenComponent(current, workInProgress, renderLanes);
    }
  }

  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}

/**
 * 是否保留 fallback
 */
function shouldRemainOnFallback(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  if (current !== null) {
    const suspenseState = current.memoizedState as SuspenseState;
    if (suspenseState === null) {
      return false;
    }
  }

  const suspenseContext = suspenseStackCursor.current;
  return hasSuspenseListContext(suspenseContext, ForceSuspenseFallback);
}
