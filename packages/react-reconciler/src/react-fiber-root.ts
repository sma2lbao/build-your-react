import { Container } from "react-fiber-config";
import { FiberRoot } from "./react-internal-types";
import { RootTag } from "./react-root-tags";

export function createFiberRoot(
  containerInfo: Container,
  tag: RootTag
): FiberRoot {
  const root = new FiberRootNode(containerInfo, tag);

  return root;
}

class FiberRootNode {
  containerInfo;

  tag;

  constructor(containerInfo: Container, tag: RootTag) {
    this.containerInfo = containerInfo;
    this.tag = tag;
  }
}
