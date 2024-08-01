import { eventPriorityToLane } from "./react-event-priorities";
import { createWorkInProgress } from "./react-fiber";
import { beginWork } from "./react-fiber-begin-work";
import { commitMutationEffects } from "./react-fiber-commit-work";
import { completeWork } from "./react-fiber-complete-work";
import { finishQueueingConcurrentUpdates } from "./react-fiber-concurrent-updates";
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  getNextLanes,
  includesBlockingLane,
  includesExpiredLane,
  markRootUpdated,
} from "./react-fiber-lane";
import {
  RenderTaskFn,
  ensureRootIsScheduled,
  getContinuationForRoot,
} from "./react-fiber-root-scheduler";
import { Fiber, FiberRoot } from "./react-internal-types";
import { shouldYield } from "./scheduler";
import { resolveUpdatePriority } from "react-fiber-config";

type RootExitStatus =
  | typeof RootInProgress
  | typeof RootFatalErrored
  | typeof RootErrored
  | typeof RootSuspended
  | typeof RootSuspendedWithDelay
  | typeof RootCompleted
  | typeof RootDidNotComplete;

const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

// 正在执行的FiberRoot
let workInProgressRoot: FiberRoot | null = null;

// 正在执行的Fiber
let workInProgress: Fiber | null = null;

// 正在执行的lanes
let workInProgressRootRenderLanes: Lanes = NoLanes;

let workInProgressRootExitStatus: RootExitStatus = RootInProgress;

// begin/complete 阶段处理的优先级.
export let entangledRenderLanes: Lanes = NoLanes;

/**
 * 调度更新
 * @param root
 * @param fiber
 * @param lane
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane
) {
  markRootUpdated(root, lane);

  ensureRootIsScheduled(root);
}

/**
 * 这是每个并发任务的入口点，即任何经过Scheduler的任务。
 * @param root
 * @param didTimeout
 */
export function performConcurrentWorkOnRoot(
  root: FiberRoot,
  didTimeout: boolean
): RenderTaskFn | null {
  const originalCallbackNode = root.callbackNode;

  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );

  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    !didTimeout;
  // let exitStatus = shouldTimeSlice
  //   ? renderRootConcurrent(root, lanes)
  //   : renderRootSync(root, lanes);
  let exitStatus = renderRootConcurrent(root, lanes);

  if (exitStatus !== RootInProgress) {
    let renderWasConcurrent = shouldTimeSlice;

    do {
      if (exitStatus === RootDidNotComplete) {
      } else {
        const finishedWork: Fiber = root.current.alternate!;

        root.finishedWork = finishedWork;
        root.finishedLanes = lanes;
        finishConcurrentRender(root, exitStatus, finishedWork, lanes);
      }
      break;
    } while (true);
  }

  // ensureRootIsScheduled(root);

  // return getContinuationForRoot(root, originalCallbackNode);
}

function renderRootSync(root: FiberRoot, lanes: Lanes) {
  do {
    try {
      workLoopSync();
      break;
    } catch (error) {}
  } while (true);

  if (workInProgress !== null) {
    // This is a sync render, so we should have finished the whole tree.
    throw new Error(
      "Cannot commit an incomplete root. This error is likely caused by a " +
        "bug in React. Please file an issue."
    );
  }

  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  return workInProgressRootExitStatus;
}

function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes);
  }

  do {
    try {
      workLoopConcurrent();
      break;
    } catch (thrownValue) {
      console.error("performConcurrentWorkOnRoot thrownValue: ", thrownValue);
    }
  } while (true);

  if (workInProgress !== null) {
    return RootInProgress;
  } else {
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;

    return workInProgressRootExitStatus;
  }
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  // !shouldYield()
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, entangledRenderLanes);

  // 如果这没有产生新的任务。
  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork: null | Fiber = unitOfWork;

  do {
    const current = completedWork.alternate;
    const returnFiber: null | Fiber = completedWork.return;

    const next = completeWork(current, completedWork, entangledRenderLanes);

    if (next !== null) {
      workInProgress = next;
      return;
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    completedWork = returnFiber;

    workInProgress = completedWork;
  } while (completedWork !== null);

  // dfs 执行完所有的 completedWork 后

  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

function finishConcurrentRender(
  root: FiberRoot,
  exitStatus: RootExitStatus,
  finishedWork: Fiber,
  lanes: Lanes
) {
  commitRootWhenReady(root, finishedWork, lanes);
}

function commitRootWhenReady(
  root: FiberRoot,
  finishedWork: Fiber,
  lanes: Lanes
) {
  commitRoot(root);
}

function commitRoot(root: FiberRoot) {
  commitRootImpl(root);
  return null;
}

function commitRootImpl(root: FiberRoot) {
  const finishedWork = root.finishedWork!;
  const lanes = root.finishedLanes;

  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  root.callbackNode = null;
  root.callbackPriority = NoLane;
  root.cancelPendingCommit = null;

  commitMutationEffects(root, finishedWork, lanes);

  return null;
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes) {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = lanes;
  workInProgressRootExitStatus = RootInProgress;

  finishQueueingConcurrentUpdates();

  return rootWorkInProgress;
}

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

export function getWorkInProgressRootRenderLanes(): Lanes {
  return workInProgressRootRenderLanes;
}

export function requestUpdateLane(): Lane {
  return eventPriorityToLane(resolveUpdatePriority());
}
