import { Flags } from "./react-fiber-flags";
import { Lanes } from "./react-fiber-lane";
import { WorkTag } from "./react-work-tags";

export type Fiber = {
  /**
   * 标识当前fiber节点类型；如（函数组件、Class组件、原生组件）
   */
  tag: WorkTag;

  /**
   * 唯一标识；diff时需要
   */
  key: null | string;

  elementType: any;

  type: any;

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

  pendingProps: any;
  memoizedProps: any;

  /**
   * 更新队列
   */
  updateQueue: any;

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
};

export type FiberRoot = {
  [key: string]: any;
};
