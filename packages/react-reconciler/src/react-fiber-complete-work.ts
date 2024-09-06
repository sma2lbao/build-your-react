import {
  Type,
  Props,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance,
  finalizeInitialChildren,
  supportsMutation,
} from "react-fiber-config";
import {
  Lanes,
  NoLanes,
  OffscreenLane,
  includesSomeLane,
  mergeLanes,
} from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  ContextConsumer,
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  MemoComponent,
  OffscreenComponent,
  SimpleMemoComponent,
} from "./react-work-tags";
import {
  getRootHostContainer,
  popHostContainer,
} from "./react-fiber-host-context";
import {
  DidCapture,
  NoFlags,
  Placement,
  StaticMask,
  Update,
  Visibility,
} from "./react-fiber-flags";
import { ReactContext } from "shared/react-types";
import { popProvider } from "./react-fiber-new-context";
import { popHiddenContext } from "./react-fiber-hidden-context";
import { OffscreenState } from "./react-fiber-activity-component";

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
    case Fragment:
    case ContextConsumer:
    case MemoComponent:
    case SimpleMemoComponent:
    case FunctionComponent: {
      bubbleProperties(workInProgress);
      return null;
    }
    case HostComponent: {
      const type = workInProgress.type;
      if (current !== null && workInProgress.stateNode != null) {
        // 更新
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          renderLanes
        );
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
        const instance = createInstance(
          type,
          newProps,
          rootContainerInstance,
          workInProgress
        );

        appendAllChildren(instance, workInProgress);
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
        updateHostText(current, workInProgress, oldText, newText);
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
          rootContainerInstance,
          workInProgress
        );
      }

      bubbleProperties(workInProgress);
      return null;
    }
    case ContextProvider: {
      const context: ReactContext<any> = workInProgress.type;
      popProvider(context, workInProgress);
      bubbleProperties(workInProgress);
      return null;
    }
    case OffscreenComponent: {
      popHiddenContext(workInProgress);
      const nextState: OffscreenState | null = workInProgress.memoizedState;
      const nextIsHidden = nextState !== null;

      if (current !== null) {
        const prevState: OffscreenState | null = current.memoizedState;
        const prevIsHidden = prevState !== null;
        if (prevIsHidden !== nextIsHidden) {
          workInProgress.flags |= Visibility;
        }
      } else {
        if (nextIsHidden) {
          workInProgress.flags |= Visibility;
        }
      }

      if (!nextIsHidden) {
        bubbleProperties(workInProgress);
      } else {
        // 在 OffscreenLane 优先级通道才处理
        if (
          includesSomeLane(renderLanes, OffscreenLane) &&
          (workInProgress.flags & DidCapture) === NoLanes
        ) {
          bubbleProperties(workInProgress);

          if (workInProgress.subtreeFlags & (Placement | Update)) {
            workInProgress.flags |= Visibility;
          }
        }
      }

      return null;
    }
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

function updateHostContainer(current: Fiber | null, workInProgress: Fiber) {}

/**
 * 更新阶段宿主组件触发
 * @param current
 * @param workInProgress
 */
function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: Type,
  newProps: Props,
  renderLanes: Lanes
) {
  if (supportsMutation) {
    const oldProps = current.memoizedProps;
    if (oldProps === newProps) {
      return;
    }

    markUpdate(workInProgress);
  }
}

function updateHostText(
  current: Fiber,
  workInProgress: Fiber,
  oldText: string,
  newText: string
) {
  if (supportsMutation) {
    if (oldText !== newText) {
      markUpdate(workInProgress);
    }
  }
}

function bubbleProperties(completedWork: Fiber) {
  const didBailout =
    completedWork.alternate !== null &&
    completedWork.alternate.child === completedWork.child;

  let newChildLanes: Lanes = NoLanes;
  let subtreeFlags = NoFlags;

  let child = completedWork.child;
  while (child !== null) {
    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );

    if (!didBailout) {
      subtreeFlags |= child.subtreeFlags;
      subtreeFlags |= child.flags;
    } else {
      // 优化路径；如果没有变更便去除 标记
      subtreeFlags |= child.subtreeFlags & StaticMask;
      subtreeFlags |= child.flags & StaticMask;
    }

    child.return = completedWork;
    child = child.sibling;
  }
  completedWork.subtreeFlags |= subtreeFlags;

  completedWork.childLanes = newChildLanes;
  return didBailout;
}

/**
 * 在首次渲染阶段直接将后代真实dom加到 HostRoot 上
 */
function appendAllChildren(parent: Instance, workInProgress: Fiber) {
  if (supportsMutation) {
    // 我们只创建了顶部的Fiber，但是我们需要递归它的子节点来找到所有的终端节点。
    let node = workInProgress.child;
    while (node !== null) {
      if (node.tag === HostComponent || node.tag === HostText) {
        appendInitialChild(parent, node.stateNode);
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }

      if (node === workInProgress) {
        return;
      }

      while (node.sibling === null) {
        if (node.return === null || node.return === workInProgress) {
          return;
        }
        node = node?.return;
      }

      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
}
