import * as Scheduler from "scheduler";

export const scheduleCallback = Scheduler.scheduleCallback;
export const cancelCallback = Scheduler.cancelCallback;
export const shouldYield = Scheduler.shouldYield;
export const now = Scheduler.now;
export const getCurrentPriorityLevel = Scheduler.getCurrentPriorityLevel;
export const NormalPriority = Scheduler.NormalPriority;
export const ImmediatePriority = Scheduler.ImmediatePriority;
export const UserBlockingPriority = Scheduler.UserBlockingPriority;
export const IdlePriority = Scheduler.IdlePriority;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;
