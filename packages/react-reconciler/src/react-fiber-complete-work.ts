import { createTextInstance } from "react-fiber-config";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import { HostRoot, HostText } from "./react-work-tags";

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

      updateHostContainer(current, workInProgress);

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

      return null;
    }
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

function updateHostContainer(current: null | Fiber, workInProgress: Fiber) {}
