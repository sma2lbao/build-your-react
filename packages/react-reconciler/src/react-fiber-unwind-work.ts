import { DidCapture, NoFlags, ShouldCapture } from "./react-fiber-flags";
import { popHiddenContext } from "./react-fiber-hidden-context";
import { popHostContainer } from "./react-fiber-host-context";
import { Lanes } from "./react-fiber-lane";
import { popSuspenseHandler } from "./react-fiber-suspense-context";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  HostComponent,
  HostRoot,
  OffscreenComponent,
  SuspenseComponent,
} from "./react-work-tags";

export function unwindWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot: {
      const root: FiberRoot = workInProgress.stateNode;
      popHostContainer();
      const flags = workInProgress.flags;
      if (
        (flags & ShouldCapture) !== NoFlags &&
        (flags & DidCapture) === NoFlags
      ) {
        workInProgress.flags = (flags & ~ShouldCapture) | DidCapture;
        return workInProgress;
      }
      return null;
    }
    case SuspenseComponent: {
      popSuspenseHandler(workInProgress);
      const flags = workInProgress.flags;
      if (flags & ShouldCapture) {
        workInProgress.flags = (flags & ~ShouldCapture) | DidCapture;
        return workInProgress;
      }
      return null;
    }
    case OffscreenComponent: {
      popSuspenseHandler(workInProgress);
      popHiddenContext(workInProgress);
      const flags = workInProgress.flags;
      if (flags & ShouldCapture) {
        workInProgress.flags = (flags & ~ShouldCapture) | DidCapture;
        return workInProgress;
      }
      return null;
    }
    default:
      return null;
  }
}

export function unwindInterruptedWork(
  current: Fiber | null,
  interruptedWork: Fiber,
  renderLanes: Lanes
) {
  switch (interruptedWork.tag) {
    case HostRoot: {
      const root: FiberRoot = interruptedWork.stateNode;
      popHostContainer();
      break;
    }
    case SuspenseComponent:
      popSuspenseHandler(interruptedWork);
      break;
    case OffscreenComponent:
      popSuspenseHandler(interruptedWork);
      popHiddenContext(interruptedWork);
      break;
    default:
      break;
  }
}
