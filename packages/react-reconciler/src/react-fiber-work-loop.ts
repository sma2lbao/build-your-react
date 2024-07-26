import { beginWork } from "./react-fiber-begin-work";
import { completeWork } from "./react-fiber-complete-work";
import { Lane, Lanes, NoLanes } from "./react-fiber-lane";
import { ensureRootIsScheduled } from "./react-fiber-root-scheduler";
import { Fiber, FiberRoot } from "./react-internal-types";
import { shouldYield } from "./scheduler";

// 正在执行的FiberRoot
let workInProgressRoot: FiberRoot | null = null;

// 正在执行的Fiber
let workInProgress: Fiber | null = null;

// 正在执行的lanes
let workInProgressRootRenderLanes: Lanes = NoLanes;

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
  renderRootConcurrent(root);
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
