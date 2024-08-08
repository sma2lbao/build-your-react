import { markWorkInProgressReceivedUpdate } from "./react-fiber-begin-work";
import {
  enqueueConcurrentHookUpdate,
  enqueueConcurrentHookUpdateAndEagerlyBailout,
} from "./react-fiber-concurrent-updates";
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  isSubsetOfLanes,
  mergeLanes,
} from "./react-fiber-lane";
import {
  markSkippedUpdateLanes,
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import { Dispatcher, Fiber } from "./react-internal-types";
import ReactSharedInternals from "shared/react-shared-internals";

type BasicStateAction<S> = ((state: S) => S) | S;
type Dispatch<A> = (action: A) => void;

export type Update<S, A> = {
  lane: Lane; // 更新优先级通道
  revertLane: Lane; // 待恢复的优先级通道
  action: A;
  hasEagerState: boolean; // 更早的state值标记位
  eagerState: S | null; // 更早的state值
  next: Update<S, A>; // 下一个更新
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
  useState: updateState,
};

/**
 * 执行 FunctionComponent，一般返回原生组件树
 * @param current
 * @param workInProgress
 * @param Component
 * @param props
 * @param secondArg
 * @param nextRenderLanes
 * @returns
 */
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

/**
 * useState dispatch 实现
 * @param fiber 当前fiber节点，赋值时就已绑定
 * @param queue 当前fiber的hook的 更新队列 ，赋值时就已绑定
 * @param action 由用户传入，可能是 S | S => S
 */
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
    // 不是首次渲染阶段
    const alternate = fiber.alternate;
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher = null;
        try {
          const currentState = queue.lastRenderedState;
          const eagerState = lastRenderedReducer(currentState!, action);
          update.hasEagerState = true;
          update.eagerState = eagerState;
          if (Object.is(eagerState, currentState)) {
            enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update);
            return;
          }
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

/**
 * 首次渲染阶段 useState 的 Hook 具体实现
 * @param initialState
 * @returns
 */
function mountStateImpl<S>(initialState: S | (() => S)): Hook {
  const hook = mountWorkInProgressHook();
  // () => S | S 转成统一的 S
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

/**
 * 首次渲染阶段直接创建hook
 * @returns
 */
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // fiber的memoizedState 指向 第一个 hook
    currentlyRenderingFiber!.memoizedState = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }

  return workInProgressHook;
}

/**
 * 更新阶段的useState的实现
 * @param initialState
 * @returns
 */
function updateState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, initialState);
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  return updateReducerImpl(hook, currentHook!, reducer);
}

function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    // 没有上个渲染阶段的hook
    // 找到现（旧）阶段的fiber节点
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 有代表进入现fiber的下个hook了
    nextCurrentHook = currentHook.next;
  }

  // 逻辑同 nextCurrentHook
  let nextWorkInProgressHook: Hook | null;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber?.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;
    currentHook = nextCurrentHook;
  } else {
    if (nextCurrentHook === null) {
      // 防御代码
      const currentFiber = currentlyRenderingFiber?.alternate;
      if (currentFiber === null) {
        throw new Error(
          "Update hook called on initial render. This is likely a bug in React. Please file an issue."
        );
      } else {
        throw new Error("Rendered more hooks than during the previous render.");
      }
    }

    // fiber节点的第一个hook可能进入
    currentHook = nextCurrentHook;

    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseQueue,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };

    if (workInProgressHook === null) {
      // 第一个hook
      currentlyRenderingFiber!.memoizedState = workInProgressHook = newHook;
    } else {
      // 加入到hook环中
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }

  return workInProgressHook!;
}

function updateReducerImpl<S, A>(
  hook: Hook,
  current: Hook,
  reducer: (state: S, action: A) => S
): [S, Dispatch<A>] {
  const queue = hook.queue;

  if (queue === null) {
    throw new Error(
      "Should have a queue. You are likely calling Hooks conditionally, " +
        "which is not allowed. (https://react.dev/link/invalid-hook-call)"
    );
  }

  queue.lastRenderedReducer = reducer;

  let baseQueue = hook.baseQueue;

  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }

    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  const baseState = hook.baseState;
  if (baseQueue === null) {
    hook.memoizedState = baseState;
  } else {
    const first = baseQueue.next;
    let newState = baseState;

    let newBaseState = null;
    let newBaseQueueFirst: null | Update<S, A> = null;
    let newBaseQueueLast: null | Update<S, A> = null;
    let update = first;
    let didReadFromEntangledAsyncAction = false;

    do {
      const updateLane = update.lane;

      // TODO
      const revertLane = update.revertLane;

      // 处理更新
      const action = update.action;
      if (update.hasEagerState) {
        newState = update.eagerState;
      } else {
        newState = reducer(newState, action);
      }
      update = update.next;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      (newBaseQueueLast as Update<S, A>).next = newBaseQueueFirst!;
    }

    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  if (baseQueue === null) {
    queue.lanes = NoLanes;
  }

  const dispatch: Dispatch<A> = queue.dispatch;

  return [hook.memoizedState, dispatch];
}

/**
 *
 * @param state
 * @param action
 * @returns
 */
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
  currentHook = null;
  workInProgressHook = null;
}

function isRenderPhaseUpdate(fiber: Fiber): boolean {
  const alternate = fiber.alternate;

  return (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  );
}
