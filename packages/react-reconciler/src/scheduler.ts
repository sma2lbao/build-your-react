import * as Scheduler from "scheduler";

export const scheduleCallback = Scheduler.scheduleCallback;
export const cancelCallback = Scheduler.cancelCallback;
export const shouldYield = Scheduler.shouldYield;
export const now = Scheduler.now;
export const getCurrentPriorityLevel = Scheduler.getCurrentPriorityLevel;
export const NormalPriority = Scheduler.NormalPriority;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;
