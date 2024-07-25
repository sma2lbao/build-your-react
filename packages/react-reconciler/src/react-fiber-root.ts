import { Container } from "react-fiber-config";
import { Fiber, FiberRoot } from "./react-internal-types";
import { ConcurrentRoot, RootTag } from "./react-root-tags";
import { NoLanes } from "./react-fiber-lane";
import { createHostRootFiber } from "./react-fiber";
import { initializeUpdateQueue } from "./react-fiber-class-update-queue";

/**
 * 创建一个FiberRoot；并将 current 指向 宿主根fiber; 并让该fiber的stateNode属性指向 fiberRoot；
 * 便于 其他fiber -> fiber.return -> ... -> HostRoot fiber -> fiber.stateNode -> FiberRoot
 * @param containerInfo
 * @param tag
 * @returns
 */
export function createFiberRoot(
  containerInfo: Container,
  tag: RootTag
): FiberRoot {
  const root = new FiberRootNode(containerInfo, tag);

  const uninitializedFiber = createHostRootFiber();
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  initializeUpdateQueue(uninitializedFiber);

  return root as FiberRoot;
}

class FiberRootNode implements Omit<FiberRoot, "current"> {
  /**
   * 容器，dom环境中如 #root element
   */
  containerInfo: Container;

  /**
   * 模式标记：1：并发模式；0：传统模式
   */
  tag: RootTag = ConcurrentRoot;

  pendingChildren = null;

  current: Fiber | null = null;

  finishedWork = null;

  next = null;

  pendingLanes = NoLanes;
  suspendedLanes = NoLanes;
  pingedLanes = NoLanes;
  expiredLanes = NoLanes;
  finishedLanes = NoLanes;

  constructor(containerInfo: Container, tag: RootTag) {
    this.containerInfo = containerInfo;
    this.tag = tag;
  }
}
