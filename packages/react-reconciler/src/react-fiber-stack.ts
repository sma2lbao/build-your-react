export type StackCursor<T> = { current: T };

/* 使用数组存储，值的类型可以是任意类型，可以是 Root DOM 可以是用户自定义的类型 */
const valueStack: Array<any> = [];

/* 全局变量，栈位置 */
let index = -1;

/**
 * 创建一个句柄，方便操作
 * @param defaultValue
 * @returns
 */
export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  };
}

export function isEmpty(): boolean {
  return index === -1;
}

/**
 * 出栈
 * @param cursor
 * @returns
 */
export function pop<T>(cursor: StackCursor<T>): void {
  if (index < 0) {
    return;
  }

  cursor.current = valueStack[index];

  valueStack[index] = null;

  index--;
}

/**
 * 入栈
 * @param cursor
 * @param value
 */
export function push<T>(cursor: StackCursor<T>, value: T): void {
  index++;

  valueStack[index] = cursor.current;

  cursor.current = value;
}
