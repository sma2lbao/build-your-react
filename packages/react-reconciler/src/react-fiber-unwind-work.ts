import { popHostContainer } from "./react-fiber-host-context";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import { HostRoot } from "./react-work-tags";

export function unwindWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot:
      const root: FiberRoot = workInProgress.stateNode;
      popHostContainer();
      const flags = workInProgress.flags;

      return null;
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
    default:
      break;
  }
}
