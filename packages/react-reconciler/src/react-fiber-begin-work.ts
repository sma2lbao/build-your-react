import { shouldSetTextContent } from "react-fiber-config";
import { mountChildFibers, reconcileChildFibers } from "./react-child-fiber";
import { Lanes } from "./react-fiber-lane";
import { RootState } from "./react-fiber-root";
import { Fiber, FiberRoot } from "./react-internal-types";
import { HostComponent, HostRoot, HostText } from "./react-work-tags";
import { pushHostContainer } from "./react-fiber-host-context";
import {
  cloneUpdateQueue,
  processUpdateQueue,
} from "./react-fiber-class-update-queue";

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

  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
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

  const nextChildren = nextState.element;

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
