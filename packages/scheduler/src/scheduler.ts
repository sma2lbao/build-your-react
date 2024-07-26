import {
  frameYieldMs,
  lowPriorityTimeout,
  normalPriorityTimeout,
  userBlockingPriorityTimeout,
} from "./scheduler-feature-flags";
import { peek, push } from "./scheduler-min-heap";
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  PriorityLevel,
  UserBlockingPriority,
} from "./scheduler-priorities";

export type Callback = (isSync: boolean) => Callback | undefined;

let currentTask: Task | null = null;
let currentPriorityLevel: PriorityLevel = NormalPriority;

const maxSigned31BitInt = 1073741823;

const taskQueue: Array<Task> = [];
const timerQueue: Array<Task> = [];

let taskIdCounter = 1;

let isHostTimeoutScheduled = false;

export type Task = {
  id: number;
  callback: Callback | null;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
  isQueued?: boolean;
};

export function getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

let frameInterval = frameYieldMs;
let startTime = -1;
export function shouldYield(): boolean {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false;
  }

  return true;
}

export function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  option?: { delay: number }
): Task {
  const currentTime = getCurrentTime();

  let startTime = currentTime + (option?.delay ?? 0);

  let timeout;

  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = -1;
      break;
    case UserBlockingPriority:
      timeout = userBlockingPriorityTimeout;
      break;
    case IdlePriority:
      timeout = maxSigned31BitInt;
      break;
    case LowPriority:
      timeout = lowPriorityTimeout;
      break;
    case NormalPriority:
    default:
      timeout = normalPriorityTimeout;
      break;
  }

  let expirationTime = startTime + timeout;

  const newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };

  if (startTime > currentTime) {
    newTask.sortIndex = startTime;

    push(timerQueue, newTask);

    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      if (isHostTimeoutScheduled) {
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
  }

  return newTask;
}

const initialTime = Date.now();
function getCurrentTime(): number | DOMHighResTimeStamp {
  if (
    typeof performance === "object" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now() - initialTime;
}

function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false;

  advanceTimers(currentTime);
}
