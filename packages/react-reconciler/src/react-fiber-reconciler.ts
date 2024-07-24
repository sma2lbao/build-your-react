import { Lane } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import { ReactNodeList } from "shared/react-types";
import { Container } from "react-fiber-config";
import { createFiberRoot } from "./react-fiber-root";
import { RootTag } from "./react-root-tags";

type OpaqueRoot = FiberRoot;

export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent?: React$Component<any, any>
) {
  const current = container.current;
  const lane = 1;
  updateContainerImpl(current, lane, element, container, parentComponent);
}

function updateContainerImpl(
  rootFiber: Fiber,
  lane: Lane,
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent?: React$Component<any, any>
): void {}

export function createContainer(
  containerInfo: Container,
  tag: RootTag
): OpaqueRoot {
  const initialChildren = null;

  return createFiberRoot(containerInfo, tag);
}
