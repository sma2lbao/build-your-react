import { Lane } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import { ReactNodeList } from "shared/react-types";
import { Container } from "react-fiber-config";
import { createFiberRoot } from "./react-fiber-root";
import { RootTag } from "./react-root-tags";
import { createUpdate, enqueueUpdate } from "./react-fiber-class-update-queue";
import {
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";

type OpaqueRoot = FiberRoot;

export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent?: React$Component<any, any>
): Lane {
  const current = container.current;
  const lane = requestUpdateLane();
  updateContainerImpl(current, lane, element, container, parentComponent);
  return lane;
}

function updateContainerImpl(
  rootFiber: Fiber,
  lane: Lane,
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent?: React$Component<any, any>
): void {
  const update = createUpdate(lane);

  update.payload = { element };

  const root = enqueueUpdate(rootFiber, update, lane);

  if (root !== null) {
    scheduleUpdateOnFiber(root, rootFiber, lane);
  }
}

export function createContainer(
  containerInfo: Container,
  tag: RootTag
): OpaqueRoot {
  return createFiberRoot(containerInfo, tag);
}
