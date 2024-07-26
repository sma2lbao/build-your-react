import * as Scheduler from "scheduler";

export const scheduleCallback = Scheduler.unstable_scheduleCallback;
export const cancelCallback = Scheduler.unstable_cancelCallback;
export const shouldYield = Scheduler.shouldYield;
export const now = Scheduler.unstable_now;
export const getCurrentPriorityLevel = Scheduler.getCurrentPriorityLevel;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;
