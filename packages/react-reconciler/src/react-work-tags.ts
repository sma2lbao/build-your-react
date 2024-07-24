/**
 * 组件类型
 */
export type WorkTag =
  | typeof FunctionComponent
  | typeof ClassComponent
  | typeof HostRoot
  | typeof HostText;

/**
 * 函数组件
 */
export const FunctionComponent = 0;

/**
 * 类组件
 */
export const ClassComponent = 1;

/**
 * 原生组件
 */
export const HostRoot = 3;

/**
 * 字符串
 */
export const HostText = 6;
