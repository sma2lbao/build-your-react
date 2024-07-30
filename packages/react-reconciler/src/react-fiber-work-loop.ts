import { beginWork } from "./react-fiber-begin-work";
import { completeWork } from "./react-fiber-complete-work";
import {
  Lane,
  Lanes,
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

type RootExitStatus = typeof RootInProgress;

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
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);

  ensureRootIsScheduled(root);

  return getContinuationForRoot(root, originalCallbackNode);
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
  do {
    try {
      workLoopConcurrent();
      break;
    } catch (thrownValue) {
      console.error("performConcurrentWorkOnRoot thrownValue: ", thrownValue);
    }
  } while (true);
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
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
}

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

export function getWorkInProgressRootRenderLanes(): Lanes {
  return workInProgressRootRenderLanes;
}
