import { enqueueConcurrentClassUpdate } from "./react-fiber-concurrent-updates";
import { Lane, Lanes, NoLane, NoLanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

export type Update<State> = {
  lane: Lane;

  tag: 0 | 1 | 2 | 3;
  payload: any;
  callback: (() => any) | null;

  next: Update<State> | null;
};

export type SharedQueue<State> = {
  pending: Update<State> | null;
  lanes: Lanes;
  hiddenCallbacks: Array<() => any> | null;
};

export type UpdateQueue<State> = {
  baseState: State;
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;
  shared: SharedQueue<State>;
  callbacks: Array<() => any> | null;
};

export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      lanes: NoLanes,
      hiddenCallbacks: null,
    },
    callbacks: null,
  };

  fiber.updateQueue = queue;
}

export function createUpdate(lane: Lane): Update<any> {
  const update: Update<any> = {
    lane,

    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
  };
  return update;
}

export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  lane: Lane
): FiberRoot | null {
  const updateQueue = fiber.updateQueue;

  if (updateQueue === null) {
    return null;
  }

  const sharedQueue: SharedQueue<State> = updateQueue.shared;

  return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
}

export function cloneUpdateQueue<State>(
  current: Fiber,
  workInProgress: Fiber
): void {
  const queue: UpdateQueue<State> = workInProgress.updateQueue;
  const currentQueue: UpdateQueue<State> = current.updateQueue;

  if (queue === currentQueue) {
    const clone: UpdateQueue<State> = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
      callbacks: null,
    };
    workInProgress.updateQueue = clone;
  }
}

/**
 * TODO: 详解
 * @param workInProgress
 * @param props
 * @param instance
 * @param renderLanes
 */
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderLanes: Lanes
): void {
  const queue: UpdateQueue<State> = workInProgress.updateQueue;

  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  let pendingQueue = queue.shared.pending;

  if (pendingQueue !== null) {
    queue.shared.pending = null;

    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;

    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    } else {
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;

    const current = workInProgress.alternate;
    if (current !== null) {
      const currentQueue: UpdateQueue<State> = current.updateQueue;
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }

  if (firstBaseUpdate !== null) {
    let newState = queue.baseState;
    let newLanes: Lanes = NoLanes;

    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate: Update<State> | null = null;

    let update: Update<State> = firstBaseUpdate;
    do {
      const updateLane = update.lane;

      if (newLastBaseUpdate !== null) {
        const clone: Update<State> = {
          lane: NoLane,
          tag: update.tag,
          payload: update.payload,
          callback: null,
          next: null,
        };

        newLastBaseUpdate = (newLastBaseUpdate as Update<State>).next = clone;
      }

      newState = getStateFromUpdate(
        workInProgress,
        queue,
        update,
        newState,
        props,
        instance
      );

      update = update.next as any;

      if (update === null) {
        pendingQueue = queue.shared.pending;
        if (pendingQueue === null) {
          break;
        } else {
          const lastPendingUpdate = pendingQueue;
          const firstPendingUpdate = lastBaseUpdate?.next;
          lastPendingUpdate.next = null;
          update = firstPendingUpdate!;
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);

    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState as State;
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    if (firstBaseUpdate === null) {
      queue.shared.lanes = NoLanes;
    }

    workInProgress.lanes = newLanes;
    workInProgress.memoizedState = newState;
  }
}

function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any
) {
  switch (update.tag) {
    case ReplaceState: {
      const payload = update.payload;
      const nextState = payload.call(instance, prevState, nextProps);
      return nextState;
    }
    case UpdateState: {
      const payload = update.payload;
      let partialState = payload;
      if (partialState == null) {
        return prevState;
      }
      return Object.assign({}, prevState, partialState);
    }
  }

  return prevState;
}
