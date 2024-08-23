import { NoFlags, Placement } from "./react-fiber-flags";
import { Fiber } from "./react-internal-types";
import { HostRoot } from "./react-work-tags";

export function getNearestMountedFiber(fiber: Fiber): Fiber | null {
  let node = fiber;
  let nearestMounted: null | Fiber = fiber;
  if (!fiber.alternate) {
    let nextNode: Fiber | null = node;
    do {
      node = nextNode;
      if ((node.flags & Placement) !== NoFlags) {
        nearestMounted = node.return;
      }
      nextNode = node.return;
    } while (nextNode);
  } else {
    while (node.return) {
      node = node.return;
    }
  }

  if (node.tag === HostRoot) {
    return nearestMounted;
  }

  return null;
}
