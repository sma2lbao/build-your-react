import { Wakeable } from "shared/react-types";
import { Incomplete } from "./react-fiber-flags";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  attachPingListener,
  renderDidSuspendDelayIfPossible,
} from "./react-fiber-work-loop";

export function throwException(
  root: FiberRoot,
  returnFiber: Fiber | null,
  sourceFiber: Fiber,
  value: any,
  rootRenderLanes: Lanes
): boolean {
  sourceFiber.flags |= Incomplete;

  if (value !== null && typeof value === "object") {
    if (typeof value.then === "function") {
      // 异步组件
      const wakeable: Wakeable = value;

      // TODO Suspense Boundary

      attachPingListener(root, wakeable, rootRenderLanes);
      renderDidSuspendDelayIfPossible();
      return false;
    }
  }

  if (returnFiber === null) {
    return true;
  }
  return false;
}
