import { Container } from "react-fiber-config";
import { Flags } from "./react-fiber-flags";
import { Lane, Lanes } from "./react-fiber-lane";
import { RootTag } from "./react-root-tags";
import { WorkTag } from "./react-work-tags";
import { TypeOfMode } from "./react-type-of-mode";
import {
  ReactContext,
  RefObject,
  StartTransitionOptions,
  Wakeable,
} from "shared/react-types";

export interface Fiber {
  /**
   * 标识当前fiber节点类型；如（函数组件、Class组件、原生组件）
   */
  tag: WorkTag;

  /**
   * 唯一标识；diff时需要
   */
  key: null | string;

  /**
   * 元素的值类型（比如 Fragment 组件的 elementType为 REACT_FRAGMENT_TYPE ）。
   *  Offscreen 的 REACT_OFFSCREEN_TYPE
   * React.lazy 的 elementType 为 { $$typeof: REACT_LAZY_TYPE }
   */
  elementType: any;

  /**
   * 与此fiber关联的解析函数/类。
   */
  type: any;

  /**
   * 与该fiber相关联的真实dom。
   */
  stateNode: any;

  /**
   * 在自顶向下遍历时用到；（父节点）
   */
  return: Fiber | null;

  /**
   * 子节点
   */
  child: Fiber | null;

  /**
   * 右相邻节点
   */
  sibling: Fiber | null;

  /**
   * 同级节点位置
   */
  index: number;

  ref: null | RefObject;

  /**
   * 要更新的prop
   */
  pendingProps: any;
  /**
   * 当前prop
   */
  memoizedProps: any;
  /**
   * 更新队列
   */
  updateQueue: any;

  /**
   * 一般用来缓存当前 fiber的内部值，不同类型的fiber缓存不同类型的值
   * FunctionComponent 组件指向 第一个 HOOK
   * OffscreenComponent 存储 baseLane
   */
  memoizedState: any;

  /**
   * useContext 需要用到，用来指向 context 链表
   */
  dependencies: Dependencies | null;

  mode: TypeOfMode;

  // Effect
  /**
   * 副作用标记位
   */
  flags: Flags;
  /**
   * 子树标记
   */
  subtreeFlags: Flags;

  /**
   * 待删除的Fiber数组（子节点）
   */
  deletions: Array<Fiber> | null;

  /**
   * 优先级
   */
  lanes: Lanes;

  /**
   * 子节点优先级
   */
  childLanes: Lanes;

  /**
   * 相对fiber；每个复用的fiber都有alternate
   */
  alternate: Fiber | null;
}

interface BaseFiberRootProperties {
  /**
   * 根节点类型（并发模式等）
   */
  tag: RootTag;
  /**
   * 原生标签容器
   */
  containerInfo: Container;

  /**
   * 仅用于持久更新。
   */
  pendingChildren: any;

  /**
   * 当前活跃的根fiber。这是树的可变节点。
   */
  current: Fiber;

  /**
   * 用来缓存异步组件的回调函数，如 React.lazy 引入的组件
   */
  pingCache: WeakMap<Wakeable, Set<any>> | null;

  /**
   * 已完成的正在进行的HostRoot工作，准备提交。
   */
  finishedWork: Fiber | null;

  cancelPendingCommit: null | (() => void);

  /**
   * 用于创建一个链表，该链表表示所有在其上安排了待处理任务的根。
   */
  next: FiberRoot | null;

  callbackNode: any;
  callbackPriority: Lane;

  /**
   * 待处理的任务通道
   */
  pendingLanes: Lanes;
  /**
   * 暂停的任务通道
   */
  suspendedLanes: Lanes;

  /**
   * 没有完成的任务通道
   */
  pingedLanes: Lanes;
  /**
   * 过期的任务通道
   */
  expiredLanes: Lanes;

  /**
   * 完成的任务通道
   */
  finishedLanes: Lanes;
}

export interface FiberRoot extends BaseFiberRootProperties {
  [key: string]: any;
}

type BasicStateAction<S> = ((state: S) => S) | S;
type Dispatch<A> = (action: A) => void;

/**
 * Hook 的类型定义
 */
export type Dispatcher = {
  readContext<T>(context: ReactContext<T>): T;
  useId(): string;
  useReducer<S, I, A>(
    reducer: (state: S, action: A) => S,
    initialArg: I,
    init?: (i: I) => S
  ): [S, Dispatch<A>];
  useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>];
  useDeferredValue<T>(value: T, initialValue?: T): T;
  useRef<T>(initialValue: T): { current: T };
  useEffect(
    create: () => (() => void) | void,
    deps: Array<any> | void | null
  ): void;
  useLayoutEffect(
    create: () => (() => void) | void,
    deps: Array<any> | void | null
  ): void;
  useMemo<T>(create: () => T, deps: Array<any> | void | null): T;
  useCallback<T>(callback: T, deps: Array<any> | void | null): T;
  useContext<T>(context: ReactContext<T>): T;
  useTransition(): [
    boolean,
    (callback: () => void, options?: StartTransitionOptions) => void
  ];
  useSyncExternalStore<T>(
    subscribe: (fn: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ): T;
  useImperativeHandle<T>(
    ref: { current: T | null } | ((inst: T | null) => any) | null | void,
    create: () => T,
    deps: Array<any> | void | null
  ): void;
};

/**
 * useContext时全局对象依赖的类型定义
 */
export type ContextDependency<T> = {
  context: ReactContext<T>;
  next: ContextDependency<any> | null;
  memoizedValue: T;
  [key: string]: any;
};

export type Dependencies = {
  lanes: Lanes;
  firstContext: ContextDependency<any> | null;
  [key: string]: any;
};
