import {
  frameYieldMs,
  lowPriorityTimeout,
  normalPriorityTimeout,
  userBlockingPriorityTimeout,
} from "./scheduler-feature-flags";
import { peek, pop, push } from "./scheduler-min-heap";
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  PriorityLevel,
  UserBlockingPriority,
} from "./scheduler-priorities";

export type Callback = (isSync: boolean) => Callback | null;

export type Task = {
  id: number;
  callback: Callback | null;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
  isQueued?: boolean;
};

let currentTask: Task | null = null;
let currentPriorityLevel: PriorityLevel = NormalPriority;

const maxSigned31BitInt = 1073741823;

const taskQueue: Array<Task> = [];
const timerQueue: Array<Task> = [];

const initialTime = Date.now();

let taskIdCounter = 1;
let taskTimeoutID: NodeJS.Timeout | number = -1;
let isMessageLoopRunning = false;

let isHostTimeoutScheduled = false;
let isPerformingWork = false;

let frameInterval = frameYieldMs;
let startTime = -1;

export function getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

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
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);

    if (!isHostTimeoutScheduled && !isPerformingWork) {
      isHostTimeoutScheduled = true;
      requestHostCallback();
    }
  }

  return newTask;
}

function requestHostCallback() {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

function schedulePerformWorkUntilDeadline() {
  if (typeof setImmediate === "function") {
    setImmediate(performWorkUntilDeadline);
  } else if (typeof MessageChannel !== "undefined") {
    const channel = new MessageChannel();
    const port = channel.port2;
    channel.port1.onmessage = performWorkUntilDeadline;
    port.postMessage(null);
  } else {
    setTimeout(performWorkUntilDeadline, 0);
  }
}

function performWorkUntilDeadline() {
  if (isMessageLoopRunning) {
    const currentTime = getCurrentTime();

    startTime = currentTime;

    let hasMoreWork = true;

    try {
      hasMoreWork = flushWork(currentTime);
    } finally {
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
      }
    }
  }
}

function flushWork(initialTime: number): boolean {
  isHostTimeoutScheduled = false;

  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;

  const previousPriorityLevel = currentPriorityLevel;

  try {
    return workLoop(initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

function workLoop(initialTime: number): boolean {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);

  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYield()) {
      break;
    }

    const callback = currentTask.callback;
    if (typeof callback === "function") {
      currentTask.callback = null;

      currentPriorityLevel = currentTask.priorityLevel;

      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;

      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();

      if (typeof continuationCallback === "function") {
        currentTask.callback = continuationCallback;
        advanceTimers(currentTime);
        return true;
      }
    } else {
      pop(taskQueue);
    }

    currentTask = peek(taskQueue);
  }

  if (currentTask !== null) {
    return true;
  } else {
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false;
  }
}

function requestHostTimeout(
  callback: (currentTime: number) => void,
  ms: number
) {
  taskTimeoutID = setTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

function cancelHostTimeout() {
  clearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

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

function advanceTimers(currentTime: number) {
  let timer = peek(timerQueue);

  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
    } else {
      return;
    }
    timer = peek(timerQueue);
  }
}

export function cancelCallback(task: Task) {
  task.callback = null;
}

export const now = getCurrentTime;

export {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  type PriorityLevel,
  UserBlockingPriority,
};
