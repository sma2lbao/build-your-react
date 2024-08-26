import {
  DefaultEventPriority,
  DiscreteEventPriority,
  eventPriorityToLane,
  lanesToEventPriority,
  lowerEventPriority,
} from "./react-event-priorities";
import { createWorkInProgress, resetWorkInProgress } from "./react-fiber";
import { beginWork, replayFunctionComponent } from "./react-fiber-begin-work";
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
} from "./react-fiber-commit-work";
import { completeWork } from "./react-fiber-complete-work";
import {
  finishQueueingConcurrentUpdates,
  getConcurrentlyUpdatedLanes,
} from "./react-fiber-concurrent-updates";
import {
  BeforeMutationMask,
  HostEffectMask,
  Incomplete,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveMask,
} from "./react-fiber-flags";
import { resetHooksOnUnwind } from "./react-fiber-hooks";
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  claimNextTransitionLane,
  getEntangledLanes,
  getNextLanes,
  includesBlockingLane,
  includesExpiredLane,
  markRootFinished,
  markRootSuspended,
  markRootUpdated,
  mergeLanes,
} from "./react-fiber-lane";
import {
  RenderTaskFn,
  ensureRootIsScheduled,
  getContinuationForRoot,
} from "./react-fiber-root-scheduler";
import { isThenableResolved } from "./react-fiber-thenable";
import { unwindInterruptedWork, unwindWork } from "./react-fiber-unwind-work";
import { Fiber, FiberRoot } from "./react-internal-types";
import { FunctionComponent, HostComponent } from "./react-work-tags";
import {
  scheduleCallback,
  shouldYield,
  NormalPriority as NormalSchedulerPriority,
} from "./scheduler";
import {
  resolveUpdatePriority,
  setCurrentUpdatePriority,
  getCurrentUpdatePriority,
} from "react-fiber-config";

type RootExitStatus =
  | typeof RootInProgress
  | typeof RootFatalErrored
  | typeof RootErrored
  | typeof RootSuspended
  | typeof RootSuspendedWithDelay
  | typeof RootCompleted
  | typeof RootDidNotComplete;

/**
 * 处理中
 */
const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
/**
 * 挂起中
 */
const RootSuspended = 3;
/**
 * 准备恢复挂起
 */
const RootSuspendedWithDelay = 4;
/**
 * 完成
 */
const RootCompleted = 5;
/**
 * 未完成
 */
const RootDidNotComplete = 6;

type SuspendedReason =
  | typeof NotSuspended
  | typeof SuspendedOnError
  | typeof SuspendedOnData
  | typeof SuspendedOnImmediate
  | typeof SuspendedOnInstance
  | typeof SuspendedOnInstanceAndReadyToContinue
  | typeof SuspendedOnDeprecatedThrowPromise
  | typeof SuspendedAndReadyToContinue
  | typeof SuspendedOnHydration;

const NotSuspended = 0;
const SuspendedOnError = 1;
const SuspendedOnData = 2;
const SuspendedOnImmediate = 3;
const SuspendedOnInstance = 4;
const SuspendedOnInstanceAndReadyToContinue = 5;
const SuspendedOnDeprecatedThrowPromise = 6;
const SuspendedAndReadyToContinue = 7;
const SuspendedOnHydration = 8;

// 正在执行的FiberRoot
let workInProgressRoot: FiberRoot | null = null;

// 正在执行的Fiber
let workInProgress: Fiber | null = null;

// 正在执行的lanes
let workInProgressRootRenderLanes: Lanes = NoLanes;

// 是否有 副作用
let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;

// 如果此通道调度延迟工作，则此通道为延迟任务的通道。
let workInProgressDeferredLane: Lane = NoLane;
// 暂停原因
let workInProgressSuspendedReason: SuspendedReason = NotSuspended;
let workInProgressThrownValue: any = null;

let workInProgressRootExitStatus: RootExitStatus = RootInProgress;

// 渲染过程中被访问的Fiber剩余的更新工作。只包括未处理的更新，不包括保释的孩子。
let workInProgressRootSkippedLanes: Lanes = NoLanes;

// begin/complete 阶段处理的相互有依赖关系的优先级.
export let entangledRenderLanes: Lanes = NoLanes;

/**
 * 调度更新入口
 * @param root
 * @param fiber
 * @param lane
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane
) {
  if (
    root.cancelPendingCommit !== null ||
    (root === workInProgressRoot &&
      workInProgressSuspendedReason === SuspendedOnData)
  ) {
    prepareFreshStack(root, NoLanes);
    markRootSuspended(
      root,
      workInProgressRootRenderLanes,
      workInProgressDeferredLane
    );
  }

  markRootUpdated(root, lane);

  if (
    root === workInProgressRoot &&
    workInProgressRootExitStatus === RootSuspendedWithDelay
  ) {
    markRootSuspended(
      root,
      workInProgressRootRenderLanes,
      workInProgressDeferredLane
    );
  }

  ensureRootIsScheduled(root);
}

export function performSyncWorkOnRoot(root: FiberRoot, lanes: Lanes): null {
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    ensureRootIsScheduled(root);
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);

  const finishedWork = root.current.alternate as Fiber;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;

  commitRoot(root, workInProgressDeferredLane);

  ensureRootIsScheduled(root);

  return null;
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

  if (lanes === NoLanes) {
    return null;
  }

  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    !didTimeout;
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);

  if (exitStatus !== RootInProgress) {
    do {
      if (exitStatus === RootDidNotComplete) {
        markRootSuspended(root, lanes, NoLane);
      } else {
        const finishedWork: Fiber = root.current.alternate!;

        root.finishedWork = finishedWork;
        root.finishedLanes = lanes;
        finishConcurrentRender(root, exitStatus, finishedWork, lanes);
      }
      break;
    } while (true);
  }

  ensureRootIsScheduled(root);

  return getContinuationForRoot(root, originalCallbackNode);
}

function renderRootSync(root: FiberRoot, lanes: Lanes) {
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes);
  }
  outer: do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        // 暂停
        const unitOfWork = workInProgress;
        const thrownValue = workInProgressThrownValue;
        switch (workInProgressSuspendedReason) {
          default:
            workInProgressSuspendedReason = NotSuspended;
            workInProgressThrownValue = null;
            throwAndUnwindWorkLoop(root, unitOfWork, thrownValue);
            break;
        }
      }

      workLoopSync();
      break;
    } catch (thrownValue) {
      handleThrow(root, thrownValue);
    }
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

  finishQueueingConcurrentUpdates();

  return workInProgressRootExitStatus;
}

function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes);
  }

  outer: do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        const unitOfWork = workInProgress;
        const thrownValue = workInProgressThrownValue;
        resumeOrUnwind: switch (workInProgressSuspendedReason) {
          case SuspendedOnError: {
            workInProgressSuspendedReason = NotSuspended;
            workInProgressThrownValue = null;
            throwAndUnwindWorkLoop(root, unitOfWork, thrownValue);
            break;
          }
          case SuspendedOnImmediate: {
            workInProgressSuspendedReason = SuspendedAndReadyToContinue;
            break outer;
          }
          case SuspendedOnInstance: {
            workInProgressSuspendedReason =
              SuspendedOnInstanceAndReadyToContinue;
            break outer;
          }
          case SuspendedAndReadyToContinue: {
            const thenable = thrownValue;
            if (isThenableResolved(thenable)) {
              workInProgressSuspendedReason = NotSuspended;
              workInProgressThrownValue = null;
              replaySuspendedUnitOfWork(unitOfWork);
            } else {
              workInProgressSuspendedReason = NotSuspended;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root, unitOfWork, thrownValue);
            }
            break;
          }
          default: {
            throw new Error(
              "Unexpected SuspendedReason. This is a bug in React."
            );
          }
        }
      }

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
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, entangledRenderLanes);

  // 经过beginWork，fiber已经更新完成。
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

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

export function flushPassiveEffects(): boolean {
  if (rootWithPendingPassiveEffects !== null) {
    // 执行flushPassiveEffects
    const root = rootWithPendingPassiveEffects;

    const remainingLanes = pendingPassiveEffectsRemainingLanes;
    pendingPassiveEffectsRemainingLanes = NoLanes;

    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority);
    const previousPriority = getCurrentUpdatePriority();

    try {
      setCurrentUpdatePriority(priority);
      return flushPassiveEffectsImpl();
    } finally {
      setCurrentUpdatePriority(previousPriority);
    }
  }

  return false;
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  const root = rootWithPendingPassiveEffects;
  const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  pendingPassiveEffectsLanes = NoLanes;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes);

  return true;
}

function replaySuspendedUnitOfWork(unitOfWork: Fiber): void {
  let next = replayBeginWork(unitOfWork);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function replayBeginWork(unitOfWork: Fiber): null | Fiber {
  const current = unitOfWork.alternate;

  let next: Fiber | null = null;
  switch (unitOfWork.tag) {
    case FunctionComponent: {
      const Component = unitOfWork.type;
      const unresolvedProps = unitOfWork.pendingProps;

      next = replayFunctionComponent(
        current,
        unitOfWork,
        unresolvedProps,
        Component,
        workInProgressRootRenderLanes
      );
    }
    case HostComponent: {
      resetHooksOnUnwind(unitOfWork);
    }
    default: {
      unwindInterruptedWork(current, unitOfWork, workInProgressRootRenderLanes);
      unitOfWork = workInProgress = resetWorkInProgress(
        unitOfWork,
        entangledRenderLanes
      );
      next = beginWork(current, unitOfWork, entangledRenderLanes);
      break;
    }
  }

  return next;
}

/**
 * 抛出异常及恢复 workloop
 * @param root
 * @param unitOfWork
 * @param thrownValue
 */
function throwAndUnwindWorkLoop(
  root: FiberRoot,
  unitOfWork: Fiber,
  thrownValue: any
) {
  if (unitOfWork.flags & Incomplete) {
    unwindUnitOfWork(unitOfWork);
  } else {
    completeUnitOfWork(unitOfWork);
  }
}

function handleThrow(root: FiberRoot, thrownValue: any): void {
  // 组件抛出异常，一般是暂停
}

function finishConcurrentRender(
  root: FiberRoot,
  exitStatus: RootExitStatus,
  finishedWork: Fiber,
  lanes: Lanes
) {
  commitRootWhenReady(root, finishedWork, lanes, workInProgressDeferredLane);
}

/**
 * 恢复单个任务fiber （一般有错误时需要恢复时才会调用）
 * @param unitOfWork
 */
function unwindUnitOfWork(unitOfWork: Fiber): void {
  let incompleteWork: Fiber | null = unitOfWork;
  do {
    const current = incompleteWork.alternate;
    const next = unwindWork(current, incompleteWork, entangledRenderLanes);

    if (next !== null) {
      next.flags &= HostEffectMask;
      workInProgress = next;
      return;
    }

    const returnFiber: Fiber | null = incompleteWork.return;
    if (returnFiber !== null) {
      returnFiber.flags |= Incomplete;
      returnFiber.subtreeFlags = NoFlags;
      returnFiber.deletions = null;
    }

    incompleteWork = returnFiber;

    workInProgress = incompleteWork;
  } while (incompleteWork !== null);

  // 恢复了整个树的暂停任务
  workInProgressRootExitStatus = RootDidNotComplete;
  workInProgress = null;
}

function commitRootWhenReady(
  root: FiberRoot,
  finishedWork: Fiber,
  lanes: Lanes,
  spawnedLane: Lane
) {
  commitRoot(root, spawnedLane);
}

function commitRoot(root: FiberRoot, spawnedLane: Lane) {
  commitRootImpl(root, spawnedLane);
  return null;
}

function commitRootImpl(root: FiberRoot, spawnedLane: Lane) {
  do {
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);

  const finishedWork = root.finishedWork!;
  const lanes = root.finishedLanes;

  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  if (finishedWork === root.current) {
    throw new Error(
      "Cannot commit the same tree as before. This error is likely caused by " +
        "a bug in React. Please file an issue."
    );
  }

  root.callbackNode = null;
  root.callbackPriority = NoLane;
  root.cancelPendingCommit = null;

  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
  const concurrentlyUpdatedLanes = getConcurrentlyUpdatedLanes();
  remainingLanes = mergeLanes(remainingLanes, concurrentlyUpdatedLanes);

  markRootFinished(root, remainingLanes, spawnedLane);

  if (root === workInProgressRoot) {
    workInProgressRoot = null;
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;
  }

  // 如果有待处理的被动效果（passive effects），需要尽早安排一个回调来处理它们，
  // 以确保它们在提交阶段中其他可能的任务之前被处理。
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      pendingPassiveEffectsRemainingLanes = remainingLanes;
      // 使用 schedule 调度 effect 副作用， 即异步执行 useEffect
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null;
      });
    }
  }

  const subtreeHasEffects =
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffects =
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffects) {
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(DiscreteEventPriority);

    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
      root,
      finishedWork
    );
    // 在该函数中有 HookLayout 的判断，即同步执行 useLayoutEffect 的 destroy 函数（有的话）
    commitMutationEffects(root, finishedWork, lanes);

    root.current = finishedWork;

    // 在该函数中有 HookLayout 的判断，即同步执行 useLayoutEffect
    commitLayoutEffects(finishedWork, root, lanes);

    setCurrentUpdatePriority(previousPriority);
  } else {
    root.current = finishedWork;
  }

  if (rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsLanes = lanes;
  }

  remainingLanes = root.pendingLanes;

  return null;
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes) {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const cancelPendingCommit = root.cancelPendingCommit;
  if (cancelPendingCommit !== null) {
    root.cancelPendingCommit = null;
    cancelPendingCommit();
  }

  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = lanes;
  workInProgressSuspendedReason = NotSuspended;
  workInProgressRootExitStatus = RootInProgress;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressDeferredLane = NoLane;

  entangledRenderLanes = getEntangledLanes(root, lanes);

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

export function requestDeferredLane(): Lane {
  if (workInProgressDeferredLane === NoLane) {
    workInProgressDeferredLane = claimNextTransitionLane();
  }
  // TODO: 通知 suspense

  return workInProgressDeferredLane;
}

/**
 * 将合并为待处理的更新优先级通道（lane）
 * @param lane
 */
export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  workInProgressRootSkippedLanes = mergeLanes(
    lane,
    workInProgressRootSkippedLanes
  );
}

export function batchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
  return fn(a);
}
