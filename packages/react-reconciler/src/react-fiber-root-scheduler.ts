import {
  scheduleMicrotask,
  shouldAttemptEagerTransition,
} from "react-fiber-config";
import { FiberRoot } from "./react-internal-types";
import {
  Lane,
  NoLane,
  NoLanes,
  SyncLane,
  claimNextTransitionLane,
  getHighestPriorityLane,
  getNextLanes,
  includesSyncLane,
  upgradePendingLaneToSync,
} from "./react-fiber-lane";
import {
  scheduleCallback as Scheduler_scheduleCallback,
  cancelCallback as Schedule_cancelCallback,
  now,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
} from "./scheduler";
import {
  getWorkInProgressRoot,
  getWorkInProgressRootRenderLanes,
  performConcurrentWorkOnRoot,
  performSyncWorkOnRoot,
} from "./react-fiber-work-loop";

import {
  IdlePriority,
  ImmediatePriority,
  PriorityLevel,
  UserBlockingPriority,
} from "scheduler/scheduler-priorities";
import {
  ContinuousEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  lanesToEventPriority,
} from "./react-event-priorities";
import { BatchConfigTransition } from "./react-fiber-tracing-marker-component";

export type RenderTaskFn = (didTimeout: boolean) => RenderTaskFn | null;

let firstScheduledRoot: FiberRoot | null = null;
let lastScheduledRoot: FiberRoot | null = null;

/**
 * 用于防止调度冗余的微任务。
 */
let didScheduleMicrotask: boolean = false;

/**
 * 用于在没有同步工作要做时快速退出flushSync
 */
let mightHavePendingSyncWork: boolean = false;
/**
 * 执行同步中的标记
 */
let isFlushingWork: boolean = false;

/**
 * startTransition 需要使用
 */
let currentEventTransitionLane: Lane = NoLane;

/**
 * 调度FiberRoot。可能存在微任务
 * @param root
 */
export function ensureRootIsScheduled(root: FiberRoot): void {
  if (root === lastScheduledRoot || root.next !== null) {
    // 该 root 已被调度
  } else {
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
    } else {
      lastScheduledRoot.next = root;
      lastScheduledRoot = root;
    }
  }

  mightHavePendingSyncWork = true;

  if (!didScheduleMicrotask) {
    didScheduleMicrotask = true;
    // 立即调度微任务
    scheduleImmediateTask(processRootScheduleInMicrotask);
  }
}

export function getContinuationForRoot(
  root: FiberRoot,
  originalCallbackNode: any
): RenderTaskFn | null {
  scheduleTaskForRootDuringMicrotask(root, now());
  if (root.callbackNode === originalCallbackNode) {
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  return null;
}

/**
 * 在微任务队列中处理根任务调度
 */
function processRootScheduleInMicrotask() {
  didScheduleMicrotask = false;

  mightHavePendingSyncWork = false;

  const currentTime = now();

  let prev = null;
  let root = firstScheduledRoot;

  while (root !== null) {
    const next = root.next;

    // startTransition 相关
    if (
      currentEventTransitionLane !== NoLane &&
      shouldAttemptEagerTransition()
    ) {
      // 在事件期间安排了一个过渡，但我们将尝试同步呈现它。
      // 我们在popstate事件期间这样做，以保留前一个页面的滚动位置。
      upgradePendingLaneToSync(root, currentEventTransitionLane);
    }

    const nextLanes = scheduleTaskForRootDuringMicrotask(root!, currentTime);

    if (nextLanes === NoLane) {
      root.next = null;
      if (prev === null) {
        firstScheduledRoot = next;
      } else {
        prev.next = next;
      }
      if (next === null) {
        lastScheduledRoot = prev;
      }
    } else {
      prev = root;
      if (includesSyncLane(nextLanes)) {
        mightHavePendingSyncWork = true;
      }
    }
    root = next;
  }

  currentEventTransitionLane = NoLane;

  // 在微任务结束时，清除所有挂起的同步工作。这必须在最后，因为它做实际的渲染工作，可能会抛出。
  // 离散事件等属于同步任务，优先级高啊
  flushSyncWorkOnAllRoots();
}

/**
 * 在微任务周期执行回调
 * @param cb
 */
function scheduleImmediateTask(cb: () => any) {
  scheduleMicrotask(() => {
    cb();
  });
}

function scheduleTaskForRootDuringMicrotask(
  root: FiberRoot,
  currentTime: number
): Lane {
  const workInProgressRoot = getWorkInProgressRoot();
  const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();

  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );

  const existingCallbackNode = root.callbackNode;

  if (nextLanes === NoLanes) {
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return NoLane;
  }

  if (includesSyncLane(nextLanes)) {
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }

    root.callbackPriority = SyncLane;
    root.callbackNode = null;
    return SyncLane;
  } else {
    const newCallbackPriority = getHighestPriorityLane(nextLanes);

    cancelCallback(existingCallbackNode);

    let schedulerPriorityLevel: PriorityLevel;

    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediatePriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdlePriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }

    const newCallbackNode = scheduleCallback(
      schedulerPriorityLevel!,
      performConcurrentWorkOnRoot.bind(null, root)
    );

    root.callbackPriority = newCallbackPriority;
    root.callbackNode = newCallbackNode;
    return newCallbackPriority;
  }
}

export function flushSyncWorkOnAllRoots() {
  flushSyncWorkAcrossRoots_impl();
}

function flushSyncWorkAcrossRoots_impl() {
  if (isFlushingWork) {
    return;
  }

  if (!mightHavePendingSyncWork) {
    return;
  }

  let didPerformSomeWork;
  isFlushingWork = true;
  do {
    didPerformSomeWork = false;
    let root = firstScheduledRoot;
    while (root !== null) {
      const workInProgressRoot = getWorkInProgressRoot();
      const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();
      const nextLanes = getNextLanes(
        root,
        root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
      );
      if (includesSyncLane(nextLanes)) {
        didPerformSomeWork = true;
        performSyncWorkOnRoot(root, nextLanes);
      }
      root = root.next;
    }
  } while (didPerformSomeWork);
  isFlushingWork = false;
}

function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: RenderTaskFn
) {
  return Scheduler_scheduleCallback(priorityLevel, callback);
}

function cancelCallback(callbackNode: any) {
  if (callbackNode !== null) {
    Schedule_cancelCallback(callbackNode);
  }
}

export function requestTransitionLane(
  transition: BatchConfigTransition | null
): Lane {
  // 对于同一事件中具有相同优先级的所有更新，为lane分配更新的算法应该是稳定的。
  // 要做到这一点，算法的输入必须相同。
  if (currentEventTransitionLane === NoLane) {
    currentEventTransitionLane = claimNextTransitionLane();
  }
  return currentEventTransitionLane;
}
