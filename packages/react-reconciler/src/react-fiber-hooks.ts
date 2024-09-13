import { markWorkInProgressReceivedUpdate } from "./react-fiber-begin-work";
import {
  enqueueConcurrentHookUpdate,
  enqueueConcurrentHookUpdateAndEagerlyBailout,
  enqueueConcurrentRenderForLane,
} from "./react-fiber-concurrent-updates";
import {
  setCurrentUpdatePriority,
  getCurrentUpdatePriority,
} from "react-fiber-config";
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  OffscreenLane,
  SyncLane,
  includesBlockingLane,
  includesOnlyNonUrgentLanes,
  isSubsetOfLanes,
  mergeLanes,
  removeLanes,
} from "./react-fiber-lane";
import { ThenableState } from "./react-fiber-thenable";
import {
  getWorkInProgressRoot,
  getWorkInProgressRootRenderLanes,
  markSkippedUpdateLanes,
  requestDeferredLane,
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import { Dispatcher, Fiber, FiberRoot } from "./react-internal-types";
import ReactSharedInternals from "shared/react-shared-internals";
import {
  Flags,
  Passive as PassiveEffect,
  StoreConsistency,
  Update as UpdateEffect,
  LayoutStatic as LayoutStaticEffect,
} from "./react-fiber-flags";
import {
  HookFlags,
  Passive as HookPassive,
  Layout as HookLayout,
  HasEffect as HookHasEffect,
} from "./react-hook-effect-tags";
import { readContext } from "./react-fiber-new-context";
import { StartTransitionOptions } from "shared/react-types";
import {
  ContinuousEventPriority,
  higherEventPriority,
} from "./react-event-priorities";
import { BatchConfigTransition } from "./react-fiber-tracing-marker-component";

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

type StoreInstance<T> = {
  value: T;
  getSnapshot: () => T;
};

type EffectInstance = {
  destroy: void | (() => void);
};

export type Effect = {
  tag: HookFlags;
  create: () => (() => void) | void;
  inst: EffectInstance;
  deps: Array<any> | null;
  next: Effect;
};

export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null;
  events: Array<EventFunctionPayload<any, any, any>> | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
};

type EventFunctionPayload<
  Args,
  Return,
  F extends (...args: Array<Args>) => Return
> = {
  ref: {
    eventFn: F;
    impl: F;
  };
  nextImpl: F;
};

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber: Fiber | null = null;

let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;

// 在呈现阶段的任何时刻是否安排了更新。
// 这不会被重置，如果我们做另一个渲染通道;只有当我们完全计算完这个分量的时候。
// 这是一个优化，所以我们知道我们是否需要在抛出后清除渲染阶段更新。
let didScheduleRenderPhaseUpdate: boolean = false;

// 其中仅在当前渲染通道期间安排更新。每次尝试后都会重置。
// 待办事项:也许有一些方法来巩固这个与' didscheduleendphaseupdate '。
// 或者使用' numberOfReRenders '。
let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;

// 针对异步获取组件的组件 如 React.lazy()
let thenableIndexCounter: number = 0;
let thenableState: ThenableState | null = null;

/**
 * 用于 useId hook 的 id 生成
 */
let globalClientIdCounter: number = 0;

const RE_RENDER_LIMIT = 25;

const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  useState: mountState,
  useDeferredValue: mountDeferredValue,
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
  useRef: mountRef,
  useMemo: mountMemo,
  useCallback: mountCallback,
  useId: mountId,
  useReducer: mountReducer,
  useContext: readContext,
  useTransition: mountTransition,
  useSyncExternalStore: mountSyncExternalStore,
  useImperativeHandle: mountImperativeHandle,
};

const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useState: updateState,
  useDeferredValue: updateDeferredValue,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useId: updateId,
  useReducer: updateReducer,
  useContext: readContext,
  useTransition: updateTransition,
  useSyncExternalStore: updateSyncExternalStore,
  useImperativeHandle: updateImperativeHandle,
};

const HooksDispatcherOnRerender: Dispatcher = {
  readContext,

  useState: rerenderState,
  useDeferredValue: rerenderDeferredValue,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useId: updateId,
  useReducer: rerenderReducer,
  useContext: readContext,
  useTransition: rerenderTransition,
  useSyncExternalStore: updateSyncExternalStore,
  useImperativeHandle: updateImperativeHandle,
};

const ContextOnlyDispatcher: Dispatcher = {
  readContext,

  useState: throwInvalidHookError,
  useDeferredValue: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useCallback: throwInvalidHookError,
  useId: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useContext: throwInvalidHookError,
  useTransition: throwInvalidHookError,
  useSyncExternalStore: throwInvalidHookError,
  useImperativeHandle: throwInvalidHookError,
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
      // 针对Transition处理
      entangleTransitionUpdate(root, queue, lane);
    }
  }
}

function dispatchReducerAction<S, A>(
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

/**
 * 首次渲染 useState 的具体实现
 * @param initialState
 * @returns
 */
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

/**
 * 在组件的顶层作用域调用 useReducer 以创建一个用于管理状态的 reducer
 * @param reducer 用于更新 state 的纯函数。参数为 state 和 action，返回值是更新后的 state。
 * @param initialArg 用于初始化 state 的任意值。初始值的计算逻辑取决于接下来的 init 参数。
 * @param init 用于计算初始值的函数。如果存在，使用 init(initialArg) 的执行结果作为初始值，否则使用 initialArg。
 * @returns
 */
function mountReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (i: I) => S
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook();
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = initialArg;
  }

  hook.memoizedState = hook.baseState = initialState;

  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState as S,
  };

  hook.queue = queue;
  const dispatch: Dispatch<A> = (queue.dispatch = dispatchReducerAction.bind<
    null,
    [fiber: Fiber, queue: UpdateQueue<S, A>],
    [action: A],
    void
  >(null, currentlyRenderingFiber!, queue));

  return [hook.memoizedState, dispatch];
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (i: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  return updateReducerImpl(hook, currentHook!, reducer);
}

function rerenderReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initialState: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  if (queue === null) {
    throw new Error(
      "Should have a queue. You are likely calling Hooks conditionally, " +
        "which is not allowed. (https://react.dev/link/invalid-hook-call)"
    );
  }

  queue.lastRenderedReducer = reducer;

  const dispatch: Dispatch<A> = queue.dispatch;
  const lastRenderPhaseUpdate = queue.pending;
  let newState = hook.memoizedState;
  if (lastRenderPhaseUpdate !== null) {
    queue.pending = null;

    const firstRenderPhaseUpdate = lastRenderPhaseUpdate.next;
    let update = firstRenderPhaseUpdate;
    do {
      const action = update.action;
      newState = reducer(newState, action);
      update = update.next;
    } while (update !== firstRenderPhaseUpdate);

    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;

    if (hook.baseQueue === null) {
      hook.baseState = newState;
    }

    queue.lastRenderedState = newState;
  }

  return [newState, dispatch];
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

      baseState: currentHook.baseState,
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
      const updateLane = removeLanes(update.lane, OffscreenLane);
      const isHiddenUpdate = updateLane !== update.lane;
      // 是否需要跳过这次更新，（优先级比较）
      const shouldSkipUpdate = isHiddenUpdate
        ? !isSubsetOfLanes(getWorkInProgressRootRenderLanes(), updateLane)
        : !isSubsetOfLanes(renderLanes, updateLane);

      if (shouldSkipUpdate) {
        // 优先级不足
        const clone = {
          lane: updateLane,
          revertLane: update.revertLane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null as any,
        } as Update<S, A>;

        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = (newBaseQueueLast!.next as Update<S, A>) = clone;
        }
        currentlyRenderingFiber!.lanes = mergeLanes(
          currentlyRenderingFiber!.lanes,
          update.lane
        );
        markSkippedUpdateLanes(updateLane);
      } else {
        // 有足够的优先级
        const revertLane = update.revertLane;
        if (revertLane === NoLane) {
          //这不是一个乐观的更新，我们现在就要应用它。
          //但是，如果先前的更新被跳过，我们需要将此更新保留在队列中，以便稍后重新基于它更新。
          if (newBaseQueueLast !== null) {
            const clone = {
              // 这个更新将被提交，所以我们不想取消提交。
              // 使用 NoLane 可以工作，因为 0 是所有位掩码的子集，所以上面的检查永远不会跳过它。
              lane: NoLane,
              revertLane: NoLane,
              action: update.action,
              hasEagerState: update.hasEagerState,
              eagerState: update.eagerState,
              next: null as any,
            } as Update<S, A>;
            newBaseQueueLast = (newBaseQueueLast.next as Update<S, A>) = clone;
          }
        } else {
          if (isSubsetOfLanes(renderLanes, revertLane)) {
            // 如果“revert”优先级足够，就不要应用更新。
            update = update.next;
            continue;
          } else {
            // 优先级不够， 应用更新，但将其留在队列中，以便在随后的呈现中恢复或重新基于它。
            const clone = {
              //一旦我们提交了一个乐观更新，我们不应该取消提交，
              // 直到它所关联的转换已经完成(由revertLane表示)。
              // 在这里使用NoLane是有效的，因为0是所有位掩码的子集，所以上面的检查永远不会跳过它。
              lane: NoLane,
              // 重用相同的revertLane，这样我们就知道什么时候转换完成了。
              revertLane: update.revertLane,
              action: update.action,
              hasEagerState: update.hasEagerState,
              eagerState: update.eagerState,
              next: null as any,
            } as Update<S, A>;

            if (newBaseQueueLast === null) {
              newBaseQueueFirst = newBaseQueueLast = clone;
              newBaseState = newState;
            } else {
              newBaseQueueLast = (newBaseQueueLast.next as Update<S, A>) =
                clone;
            }

            currentlyRenderingFiber!.lanes = mergeLanes(
              currentlyRenderingFiber!.lanes,
              revertLane
            );

            markSkippedUpdateLanes(revertLane);
          }
        }

        // 处理更新
        const action = update.action;
        if (update.hasEagerState) {
          newState = update.eagerState;
        } else {
          newState = reducer(newState, action);
        }
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

function rerenderState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  return rerenderReducer(basicStateReducer, initialState);
}

function mountDeferredValue<T>(value: T, initialValue?: T): T {
  const hook = mountWorkInProgressHook();
  return mountDeferredValueImpl(hook, value, initialValue);
}

function mountDeferredValueImpl<T>(hook: Hook, value: T, initialValue?: T): T {
  hook.memoizedState = value;
  return value;
}

function updateDeferredValue<T>(value: T, initialValue?: T): T {
  const hook = updateWorkInProgressHook();
  const resolvedCurrentHook = currentHook as Hook;
  const prevValue: T = resolvedCurrentHook.memoizedState;
  return updateDeferredValueImpl(hook, prevValue, value, initialValue);
}

function updateDeferredValueImpl<T>(
  hook: Hook,
  prevValue: T,
  value: T,
  initialValue?: T
): T {
  if (Object.is(value, prevValue)) {
    return value;
  } else {
    // 收到新的状态值
    // 有紧急的任务 - 推迟
    const shouldDeferValue = !includesOnlyNonUrgentLanes(renderLanes);
    if (shouldDeferValue) {
      const deferredLane = requestDeferredLane();
      currentlyRenderingFiber!.lanes = mergeLanes(
        currentlyRenderingFiber!.lanes,
        deferredLane
      );

      markSkippedUpdateLanes(deferredLane);

      return prevValue;
    } else {
      // 不推迟
      markWorkInProgressReceivedUpdate();
      hook.memoizedState = value;
      return value;
    }
  }
}

function rerenderDeferredValue<T>(value: T, initialValue?: T): T {
  const hook = updateWorkInProgressHook();
  if (currentHook === null) {
    return mountDeferredValueImpl(hook, value, initialValue);
  } else {
    const prevValue: T = currentHook.memoizedState;

    return updateDeferredValueImpl(hook, prevValue, value, initialValue);
  }
}

function mountEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  mountEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber!.flags |= fiberFlags;

  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    createEffectInstance(),
    nextDeps
  );
}

function updateEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const effect: Effect = hook.memoizedState;
  const inst = effect.inst;

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevEffect: Effect = currentHook.memoizedState;
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // deps与上个阶段相同，只更新状态，不打 HookHasEffect(useEffect) 或 HookLayout（useLayoutEffect） 标记
        hook.memoizedState = pushEffect(hookFlags, create, inst, nextDeps);
        return;
      }
      // deps不相同路径
    }
  }
  // deps不相同或为null 路径

  currentlyRenderingFiber!.flags |= fiberFlags;

  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    inst,
    nextDeps
  );
}

function pushEffect(
  tag: HookFlags,
  create: () => (() => void) | void,
  inst: EffectInstance,
  deps: Array<any> | null
): Effect {
  const effect: Effect = {
    tag,
    create,
    inst,
    deps,
    next: null as any,
  };

  let componentUpdateQueue: FunctionComponentUpdateQueue | null =
    currentlyRenderingFiber!.updateQueue;

  // 组成环
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue;
    componentUpdateQueue!.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }

  return effect;
}

function mountLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  let fiberFlags: Flags = UpdateEffect;

  return mountEffectImpl(fiberFlags, HookLayout, create, deps);
}

function updateLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  return updateEffectImpl(UpdateEffect, HookLayout, create, deps);
}

function createFunctionComponentUpdateQueue(): FunctionComponentUpdateQueue {
  return {
    lastEffect: null,
    events: null,
    stores: null,
  };
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}

function mountMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();

  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;

  if (nextDeps !== null) {
    const prevDeps: Array<any> | null = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];
    }
  }
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function mountCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function updateCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (nextDeps !== null) {
    const prevDeps = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];
    }
  }
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function mountId(): string {
  const hook = mountWorkInProgressHook();

  const root = getWorkInProgressRoot() as FiberRoot;

  // TODO 前缀，FiberRoot待实现
  const identifierPrefix = root.identifierPrefix;
  const globalClientId = globalClientIdCounter++;
  const id = ":" + identifierPrefix + "r" + globalClientId.toString(32) + ":";

  hook.memoizedState = id;
  return id;
}

/**
 * id 在首次渲染阶段生成后不再改变
 * @returns
 */
function updateId(): string {
  const hook = updateWorkInProgressHook();
  const id: string = hook.memoizedState;
  return id;
}

function mountTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const stateHook = mountStateImpl(false);
  const start = startTransition.bind(
    null,
    currentlyRenderingFiber!,
    stateHook.queue,
    true,
    false
  );
  const hook = mountWorkInProgressHook();
  hook.memoizedState = start;
  return [false, start];
}

function updateTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  debugger;
  const [booleanOrThenable] = updateState(false);
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;
  const isPending = booleanOrThenable;

  return [isPending, start];
}

function rerenderTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const [booleanOrThenable] = rerenderState(false);
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;
  const isPending = booleanOrThenable;
  return [isPending, start];
}

function mountSyncExternalStore<T>(
  subscribe: (fn: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  const fiber = currentlyRenderingFiber!;
  const hook = mountWorkInProgressHook();

  const nextSnapshot = getSnapshot();
  const root = getWorkInProgressRoot();
  if (root === null) {
    throw new Error(
      "Expected a work-in-progress root. This is a bug in React. Please file an issue."
    );
  }
  const rootRenderLanes = getWorkInProgressRootRenderLanes();
  if (!includesBlockingLane(root, rootRenderLanes)) {
    // 当前更新没有 DefaultLane 和 InputContinuousLane
    pushStoreConsistencyCheck(fiber, getSnapshot, nextSnapshot);
  }

  // 每次 渲染（render）都执行getSnapshot();
  hook.memoizedState = nextSnapshot;
  const inst: StoreInstance<T> = {
    value: nextSnapshot,
    getSnapshot,
  };

  hook.queue = inst;

  // 用 effect 来订阅
  mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe));

  // 调度一个 effect 来更新可变实例字段。
  // 每当 subscribe、getSnapshot 或 值发生变化时，我们都会更新它。
  // 因为没有清理函数，而且我们可以正确地跟踪 deps，所以我们可以直接调用pusheeffect，
  // 而不需要存储任何额外的 state。出于同样的原因，我们也不需要设置 static flag。
  fiber.flags |= PassiveEffect;
  pushEffect(
    HookHasEffect | HookPassive,
    updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot),
    createEffectInstance(),
    null
  );

  return nextSnapshot;
}

function updateSyncExternalStore<T>(
  subscribe: (fn: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  const fiber = currentlyRenderingFiber!;
  const hook = updateWorkInProgressHook();

  const nextSnapshot = getSnapshot();

  const prevSnapshot = (currentHook || hook).memoizedState;
  const snapshotChanged = !Object.is(prevSnapshot, nextSnapshot);
  if (snapshotChanged) {
    hook.memoizedState = nextSnapshot;
    markWorkInProgressReceivedUpdate();
  }
  const inst = hook.queue;

  updateEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
    subscribe,
  ]);

  if (
    inst.getSnapshot !== getSnapshot ||
    snapshotChanged ||
    (workInProgressHook !== null &&
      workInProgressHook.memoizedState.tag & HookHasEffect)
  ) {
    fiber.flags |= PassiveEffect;
    pushEffect(
      HookHasEffect | HookPassive,
      updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot),
      createEffectInstance(),
      null
    );

    const root: FiberRoot | null = getWorkInProgressRoot();

    if (root === null) {
      throw new Error(
        "Expected a work-in-progress root. This is a bug in React. Please file an issue."
      );
    }
    if (!includesBlockingLane(root, renderLanes)) {
      pushStoreConsistencyCheck(fiber, getSnapshot, nextSnapshot);
    }
  }

  return nextSnapshot;
}

function mountImperativeHandle<T>(
  ref: { current: T | null } | ((inst: T | null) => any) | null | void,
  create: () => T,
  deps: Array<any> | void | null
): void {
  const effectDeps =
    deps !== null && deps !== undefined ? deps.concat([ref]) : null;

  const fiberFlags: Flags = UpdateEffect | LayoutStaticEffect;
  mountEffectImpl(
    fiberFlags,
    HookLayout,
    imperativeHandleEffect.bind(null, create, ref as any),
    effectDeps
  );
}

function updateImperativeHandle<T>(
  ref: { current: T | null } | ((inst: T | null) => any) | null | void,
  create: () => T,
  deps: Array<any> | void | null
): void {
  const effectDeps =
    deps !== null && deps !== undefined ? deps.concat([ref]) : null;

  updateEffectImpl(
    UpdateEffect,
    HookLayout,
    imperativeHandleEffect.bind(null, create, ref as any),
    effectDeps
  );
}

function imperativeHandleEffect<T>(
  create: () => T,
  ref: { current: T | null } | ((inst: T | null) => any) | null | void
): void | (() => void) {
  if (typeof ref === "function") {
    throw new Error(`ref is function`);
  } else if (ref !== null && ref !== undefined) {
    const refObject = ref;
    const inst = create();
    refObject.current = inst;
    return () => {
      refObject.current = null;
    };
  }
}

function pushStoreConsistencyCheck<T>(
  fiber: Fiber,
  getSnapshot: () => T,
  renderedSnapshot: T
): void {
  fiber.flags |= StoreConsistency;
  const check: StoreConsistencyCheck<T> = {
    getSnapshot,
    value: renderedSnapshot,
  };

  let componentUpdateQueue: FunctionComponentUpdateQueue | null =
    currentlyRenderingFiber!.updateQueue;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue;
    componentUpdateQueue.stores = [check];
  } else {
    const stores = componentUpdateQueue.stores;
    if (stores === null) {
      componentUpdateQueue.stores = [check];
    } else {
      stores.push(check);
    }
  }
}

function subscribeToStore<T>(
  fiber: Fiber,
  inst: StoreInstance<T>,
  subscribe: (fn: () => void) => () => void
): any {
  const handleStoreChange = () => {
    // 存储改变。检查自上次从存储读取数据以来快照是否发生了更改。
    if (checkIfSnapshotChanged(inst)) {
      forceStoreRerender(fiber);
    }
  };
  // 订阅并返回一个清理函数。
  return subscribe(handleStoreChange);
}

function updateStoreInstance<T>(
  fiber: Fiber,
  inst: StoreInstance<T>,
  nextSnapshot: T,
  getSnapshot: () => T
): void {
  inst.value = nextSnapshot;
  inst.getSnapshot = getSnapshot;

  if (checkIfSnapshotChanged(inst)) {
    forceStoreRerender(fiber);
  }
}

function checkIfSnapshotChanged<T>(inst: StoreInstance<T>): boolean {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !Object.is(prevValue, nextValue);
  } catch (error) {
    return true;
  }
}

/**
 * 强制以 SyncLane 通道更新
 * @param fiber
 */
function forceStoreRerender(fiber: Fiber) {
  const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, fiber, SyncLane);
  }
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

/**
 * 全局变量重置
 * @param current
 * @param workInProgress
 * @param Component
 */
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

export function resetHooksOnUnwind(workInProgress: Fiber): void {
  if (didScheduleRenderPhaseUpdate) {
    // TODO
  }

  renderLanes = NoLanes;
  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;
}

export function replaySuspendedComponentWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props) => any,
  props: Props
): any {
  const children = renderWithHooksAgain(workInProgress, Component, props);

  finishRenderingHooks(current, workInProgress, Component);
  return children;
}

function renderWithHooksAgain<Props>(
  workInProgress: Fiber,
  Component: (p: Props) => any,
  props: Props
): any {
  currentlyRenderingFiber = workInProgress;

  let numberOfReRenders: number = 0;
  let children;

  do {
    if (didScheduleRenderPhaseUpdateDuringThisPass) {
      thenableState = null;
    }
    thenableIndexCounter = 0;
    didScheduleRenderPhaseUpdateDuringThisPass = false;

    if (numberOfReRenders >= RE_RENDER_LIMIT) {
      throw new Error(
        "Too many re-renders. React limits the number of renders to prevent " +
          "an infinite loop."
      );
    }

    numberOfReRenders += 1;

    currentHook = null;
    workInProgressHook = null;

    workInProgress.updateQueue = null;

    ReactSharedInternals.H = HooksDispatcherOnRerender;
    children = Component(props);
  } while (didScheduleRenderPhaseUpdateDuringThisPass);

  return children;
}

function createEffectInstance(): EffectInstance {
  return {
    destroy: undefined,
  };
}

/**
 * 判断 useEffect 依赖更新前后的值是否相同
 * @param nextDeps
 * @param prevDeps
 */
function areHookInputsEqual(
  nextDeps: Array<any>,
  prevDeps: Array<any> | null
): boolean {
  if (prevDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }

  return true;
}

/**
 * 优化路径-复用updateQueue，去除 PassiveEffect 及 UpdateEffect 以及 lanes
 * @param current
 * @param workInProgress
 * @param lanes
 */
export function bailoutHooks(
  current: Fiber,
  workInProgress: Fiber,
  lanes: Lanes
): void {
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.flags &= ~(PassiveEffect | UpdateEffect);
  current.lanes = removeLanes(current.lanes, lanes);
}

export function resetHooksAfterThrow(): void {
  currentlyRenderingFiber = null;
  ReactSharedInternals.H = ContextOnlyDispatcher;
}

function throwInvalidHookError(): any {
  throw new Error(
    "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for" +
      " one of the following reasons:\n" +
      "1. You might have mismatching versions of React and the renderer (such as React DOM)\n" +
      "2. You might be breaking the Rules of Hooks\n" +
      "3. You might have more than one copy of React in the same app\n" +
      "See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
  );
}

/**
 *
 * @param fiber 当前 fiber 节点
 * @param queue
 * @param pendingState
 * @param finishedState
 * @param callback
 * @param options
 */
function startTransition<S>(
  fiber: Fiber,
  queue: UpdateQueue<S, BasicStateAction<S>>,
  pendingState: S,
  finishedState: S,
  callback: () => any,
  options?: StartTransitionOptions
): void {
  debugger;
  const previousPriority = getCurrentUpdatePriority();
  setCurrentUpdatePriority(
    higherEventPriority(previousPriority, ContinuousEventPriority)
  );

  const prevTransition = ReactSharedInternals.T;
  const currentTransition: BatchConfigTransition = {};

  ReactSharedInternals.T = null;
  // 以 ContinuousEventPriority 更新 pendingState 即 true;
  dispatchSetState(fiber, queue, pendingState);
  ReactSharedInternals.T = currentTransition;

  try {
    // 以 transition lane 更新 finishedState 和 callback 一起更新；
    dispatchSetState(fiber, queue, finishedState);
    callback();
  } catch (error) {
    throw error;
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactSharedInternals.T = prevTransition;
  }
}

function entangleTransitionUpdate<S, A>(
  root: FiberRoot,
  queue: UpdateQueue<S, A>,
  lane: Lane
): void {
  //
}
