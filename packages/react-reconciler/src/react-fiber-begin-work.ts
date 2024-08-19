import { shouldSetTextContent } from "react-fiber-config";
import { mountChildFibers, reconcileChildFibers } from "./react-child-fiber";
import { Lanes, NoLanes } from "./react-fiber-lane";
import { RootState } from "./react-fiber-root";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./react-work-tags";
import { pushHostContainer } from "./react-fiber-host-context";
import {
  cloneUpdateQueue,
  processUpdateQueue,
} from "./react-fiber-class-update-queue";
import {
  renderWithHooks,
  replaySuspendedComponentWithHooks,
} from "./react-fiber-hooks";
import { Ref } from "./react-fiber-flags";

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
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    null,
    renderLanes
  );

  if (current !== null && !didReceiveUpdate) {
    // TODO 优化路径
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
  }

  markRef(current, workInProgress);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostText(current: null | Fiber, workInProgress: Fiber) {
  return null;
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
