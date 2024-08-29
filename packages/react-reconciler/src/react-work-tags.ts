/**
 * 组件类型
 */
export type WorkTag =
  | typeof FunctionComponent
  | typeof ClassComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextConsumer
  | typeof ContextProvider
  | typeof MemoComponent
  | typeof SimpleMemoComponent;

/**
 * 函数组件
 */
export const FunctionComponent = 0;

/**
 * 类组件
 */
export const ClassComponent = 1;

/**
 * 根节点
 */
export const HostRoot = 3;

/**
 * 宿主组件
 */
export const HostComponent = 5;

/**
 * 字符串
 */
export const HostText = 6;

export const Fragment = 7;

export const ContextConsumer = 9;

export const ContextProvider = 10;

/**
 * 可缓存组件
 */
export const MemoComponent = 14;

/**
 * 可缓存浅比较函数组件
 */
export const SimpleMemoComponent = 15;
