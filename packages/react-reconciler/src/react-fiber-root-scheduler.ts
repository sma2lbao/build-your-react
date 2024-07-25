import { scheduleMicrotask } from "react-fiber-config";
import { FiberRoot } from "./react-internal-types";
import { Lane, NoLanes } from "./react-fiber-lane";
import {
  getWorkInProgressRoot,
  getWorkInProgressRootRenderLanes,
} from "./react-fiber-work-loop";

/**
 * 用于防止调度冗余的微任务。
 */
let didScheduleMicrotask: boolean = false;

export function ensureRootIsScheduled(root: FiberRoot): void {
  scheduleImmediateTask(processRootScheduleInMicrotask);
}

/**
 * 在微任务队列中处理根任务调度
 */
function processRootScheduleInMicrotask() {
  const nextLanes = scheduleTaskForRootDuringMicrotask(root, currentTime);
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

  const nextLanes =
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes;

  const newCallbackNode = scheduleCallback(
    nextLanes,
    performConcurrentWorkOnRoot.bind(null, root)
  );

  return nextLanes;
}

function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: RenderTaskFn
) {
  return Scheduler_scheduleCallback(priorityLevel, callback);
}
