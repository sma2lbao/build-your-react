import { enqueueConcurrentHookUpdate } from "./react-fiber-concurrent-updates";
import { Lane, Lanes, NoLane, NoLanes } from "./react-fiber-lane";
import {
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import { Dispatcher, Fiber } from "./react-internal-types";
import ReactSharedInternals from "shared/react-shared-internals";

type BasicStateAction<S> = ((state: S) => S) | S;
type Dispatch<A> = (action: A) => void;

export type Update<S, A> = {
  lane: Lane;
  revertLane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A>;
};

export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => any) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
};

export type Hook = {
  memoizedState: any;
  baseState: any;
  baseQueue: Update<any, any> | null;
  queue: any;
  next: Hook | null;
};

let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber: Fiber | null = null;

let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: mountState,
};

export function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes
): any {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  ReactSharedInternals.H =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, secondArg);

  finishRenderingHooks(current, workInProgress, Component);

  return children;
}

function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A
): void {
  const lane = requestUpdateLane();

  const update: Update<S, A> = {
    lane,
    revertLane: NoLane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null as any,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    const alternate = fiber.alternate;
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        try {
          const currentState = queue.lastRenderedState;
          const eagerState = lastRenderedReducer(currentState!, action);
          update.hasEagerState = true;
          update.eagerState = eagerState;
          // TODO 优化
        } catch (error) {}
      }
    }

    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane);
    }
  }
}

function enqueueRenderPhaseUpdate<S, A>(
  queue: UpdateQueue<S, A>,
  update: Update<S, A>
): void {
  const pending = queue.pending;

  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }

  queue.pending = update;
}

function mountState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountStateImpl(initialState);

  const queue = hook.queue;
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber!, queue);
  queue.dispatch = dispatch;

  return [hook.memoizedState, dispatch];
}

function mountStateImpl<S>(initialState: S | (() => S)): Hook {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === "function") {
    const initialStateInitializer = initialState as () => S;
    initialState = initialStateInitializer();
  }

  hook.memoizedState = hook.baseState = initialState;

  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;

  return hook;
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber!.memoizedState = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }

  return workInProgressHook;
}

function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === "function"
    ? (action as (state: S) => S)(state)
    : action;
}

function finishRenderingHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any
): void {
  renderLanes = NoLanes;
  currentlyRenderingFiber = null;
}

function isRenderPhaseUpdate(fiber: Fiber): boolean {
  const alternate = fiber.alternate;

  return (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  );
}
