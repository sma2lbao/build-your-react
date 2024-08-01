import {
  createInstance,
  createTextInstance,
  finalizeInitialChildren,
} from "react-fiber-config";
import { Lanes, NoLanes, mergeLanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import { HostComponent, HostRoot, HostText } from "./react-work-tags";
import {
  getRootHostContainer,
  popHostContainer,
} from "./react-fiber-host-context";
import { NoFlags, Update } from "./react-fiber-flags";

function markUpdate(workInProgress: Fiber) {
  workInProgress.flags |= Update;
}

export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    // FiberRoot.current -> 根Fiber
    case HostRoot: {
      const fiberRoot: FiberRoot = workInProgress.stateNode;
      // 深度遍历。 在complete阶段会最后到达 HostRoot Fiber上
      popHostContainer();

      updateHostContainer(current, workInProgress);
      bubbleProperties(workInProgress);
      return null;
    }
    case HostComponent: {
      const type = workInProgress.type;
      if (current !== null && workInProgress.stateNode != null) {
        // 更新
      } else {
        if (!newProps) {
          if (workInProgress.stateNode === null) {
            throw new Error(
              "We must have new props for new mounts. This error is likely " +
                "caused by a bug in React. Please file an issue."
            );
          }
          bubbleProperties(workInProgress);
          return null;
        }

        const rootContainerInstance = getRootHostContainer();
        const instance = createInstance(type, newProps, rootContainerInstance);

        workInProgress.stateNode = instance;

        if (finalizeInitialChildren(instance, type, newProps)) {
          markUpdate(workInProgress);
        }
      }

      bubbleProperties(workInProgress);
      return null;
    }
    case HostText: {
      const newText = newProps;
      if (current && workInProgress.stateNode !== null) {
        // 更新
        const oldText = current.memoizedProps;
        // updateHostText(current, workInProgress, oldText, newText);
      } else {
        // 渲染（新建）
        if (typeof newText !== "string") {
          throw new Error(
            "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
          );
        }

        // 获取最近的原生节点
        const rootContainerInstance = getRootHostContainer();
        workInProgress.stateNode = createTextInstance(
          newText,
          rootContainerInstance
        );
      }

      bubbleProperties(workInProgress);
      return null;
    }
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

function updateHostContainer(current: Fiber | null, workInProgress: Fiber) {}

function bubbleProperties(completedWork: Fiber) {
  // const didBailout =
  //   completedWork.alternate !== null &&
  //   completedWork.alternate.child === completedWork.child;
  const didBailout = false;

  let newChildLanes: Lanes = NoLanes;
  let subtreeFlags = NoFlags;

  if (!didBailout) {
    let child = completedWork.child;
    while (child !== null) {
      newChildLanes = mergeLanes(
        newChildLanes,
        mergeLanes(child.lanes, child.childLanes)
      );

      subtreeFlags |= child.subtreeFlags;
      subtreeFlags |= child.flags;

      child.return = completedWork;
      child = child.sibling;
    }
    completedWork.subtreeFlags |= subtreeFlags;
  }

  completedWork.childLanes = newChildLanes;
  return didBailout;
}
