import { scheduleMicrotask } from "react-fiber-config";
import { FiberRoot } from "./react-internal-types";
import {
  Lane,
  NoLane,
  NoLanes,
  SyncLane,
  getHighestPriorityLane,
  getNextLanes,
  includesSyncLane,
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
