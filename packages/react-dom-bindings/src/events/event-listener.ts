/**
 * 给target添加捕获阶段 eventType事件的listener回调函数的监听器
 * @param target
 * @param eventType
 * @param listener 回调函数
 * @returns
 */
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): Function {
  target.addEventListener(eventType, listener as (e: Event) => void, true);
  return listener;
}

/**
 * 给target添加冒泡阶段 eventType事件的listener回调函数的监听器
 * @param target
 * @param eventType
 * @param listener
 * @returns
 */
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function
) {
  target.addEventListener(eventType, listener as (e: Event) => void, false);
  return listener;
}
