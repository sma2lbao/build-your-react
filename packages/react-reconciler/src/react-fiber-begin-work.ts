import { Lanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";
import { HostRoot, HostText } from "./react-work-tags";

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
    // 更新
  } else {
    // 首次渲染
  }

  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

function updateHostRoot(
  current: null | Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  if (current === null) {
    throw new Error("Should have a current fiber. This is a bug in React.");
  }

  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState;
  const prevChildren = prevState.element;

  return workInProgress.child;
}

function updateHostText(current: null | Fiber, workInProgress: Fiber) {
  return null;
}
