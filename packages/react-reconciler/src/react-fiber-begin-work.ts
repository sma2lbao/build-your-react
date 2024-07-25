import { Lanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";

/**
 * 处理 workInProgress Fiber任务，并获取下一个任务
 * @param current
 * @param workInProgress
 * @param renderLanes
 */
export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    // 更新
  } else {
    // 首次渲染
  }
}
