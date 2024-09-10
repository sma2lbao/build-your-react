import { Wakeable } from "shared/react-types";
import { Incomplete, ScheduleRetry, ShouldCapture } from "./react-fiber-flags";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  attachPingListener,
  renderDidSuspend,
  renderDidSuspendDelayIfPossible,
} from "./react-fiber-work-loop";
import {
  getShellBoundary,
  getSuspenseHandler,
} from "./react-fiber-suspense-context";
import { OffscreenComponent, SuspenseComponent } from "./react-work-tags";
import { RetryQueue } from "./react-fiber-suspense-component";
import { noopSuspenseyCommitThenable } from "./react-fiber-thenable";

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

      const suspenseBoundary = getSuspenseHandler();
      if (suspenseBoundary !== null) {
        switch (suspenseBoundary.tag) {
          case SuspenseComponent: {
            if (getShellBoundary() === null) {
              renderDidSuspendDelayIfPossible();
            } else {
              const current = suspenseBoundary.alternate;
              if (current === null) {
                renderDidSuspend();
              }
            }

            // suspenseBoundary.flags &= ~ForceClientRender;
            markSuspenseBoundaryShouldCapture(
              suspenseBoundary,
              returnFiber,
              sourceFiber,
              root,
              rootRenderLanes
            );

            const isSuspenseyResource =
              wakeable === noopSuspenseyCommitThenable;
            if (isSuspenseyResource) {
              suspenseBoundary.flags |= ScheduleRetry;
            } else {
              const retryQueue: RetryQueue | null =
                suspenseBoundary.updateQueue;
              if (retryQueue === null) {
                suspenseBoundary.updateQueue = new Set([wakeable]);
              } else {
                retryQueue.add(wakeable);
              }
            }

            attachPingListener(root, wakeable, rootRenderLanes);
            return false;
          }
          case OffscreenComponent: {
            suspenseBoundary.flags |= ShouldCapture;

            const isSuspenseyResource =
              wakeable === noopSuspenseyCommitThenable;
            if (isSuspenseyResource) {
              suspenseBoundary.flags |= ScheduleRetry;
            } else {
              throw new Error("TODO OffscreenQueue");
              // const offscreenQueue: OffscreenQueue | null =
              //   suspenseBoundary.updateQueue;
              // if (offscreenQueue === null) {
              //   const newOffscreenQueue: OffscreenQueue = {
              //     retryQueue: new Set([wakeable]),
              //   };
              //   suspenseBoundary.updateQueue = newOffscreenQueue;
              // } else {
              //   const retryQueue = offscreenQueue.retryQueue;
              //   if (retryQueue === null) {
              //     offscreenQueue.retryQueue = new Set([wakeable]);
              //   } else {
              //     retryQueue.add(wakeable);
              //   }
              // }
              // attachPingListener(root, wakeable, rootRenderLanes);
            }

            return false;
          }
        }

        throw new Error(
          `Unexpected Suspense handler tag (${suspenseBoundary.tag}). This ` +
            "is a bug in React."
        );
      } else {
        attachPingListener(root, wakeable, rootRenderLanes);
        renderDidSuspendDelayIfPossible();
        return false;
      }
    }
  }

  if (returnFiber === null) {
    return true;
  }
  return false;
}

function markSuspenseBoundaryShouldCapture(
  suspenseBoundary: Fiber,
  returnFiber: Fiber | null,
  sourceFiber: Fiber,
  root: FiberRoot,
  rootRenderLanes: Lanes
): Fiber | null {
  suspenseBoundary.flags |= ShouldCapture;
  suspenseBoundary.lanes = rootRenderLanes;
  return suspenseBoundary;
}
