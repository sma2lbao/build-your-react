import { NoFlags, Placement } from "./react-fiber-flags";
import { Lane, Lanes, NoLanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";
import {
  ConcurrentMode,
  StrictEffectsMode,
  StrictLegacyMode,
  TypeOfMode,
} from "./react-type-of-mode";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  WorkTag,
} from "./react-work-tags";
import { ReactElement } from "shared/react-element-type";

export function createHostRootFiber(): Fiber {
  let mode = ConcurrentMode;

  mode |= StrictLegacyMode | StrictEffectsMode;

  return createFiber(HostRoot, null, null, mode);
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  const fiber = createFiber(HostText, content, null, mode);

  fiber.lanes = lanes;

  return fiber;
}

export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes
) {
  let owner = null;

  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode,
    lanes
  );

  return fiber;
}

export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: string | null,
  pendingProps: any,
  owner: Fiber | null,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let fiberTag: WorkTag = FunctionComponent;
  let resolvedType = type;
  if (typeof type === "string") {
    fiberTag = HostComponent;
  }

  const fiber = createFiber(fiberTag!, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.lanes = lanes;

  return fiber;
}

export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  /*
   * 复用current属性非常重要，在渲染阶段 根Fiber(HostRoot)也会有current树
   */
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    );
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;

    workInProgress.flags = NoFlags;

    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  workInProgress.flags = current.flags;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  return workInProgress;
}

export function resetWorkInProgress(
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber {
  workInProgress.flags &= Placement;

  const current = workInProgress.alternate;
  if (current === null) {
    workInProgress.childLanes = NoLanes;
    workInProgress.lanes = renderLanes;

    workInProgress.child = null;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.memoizedProps = null;
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;

    workInProgress.stateNode = null;
  } else {
    workInProgress.childLanes = current.childLanes;
    workInProgress.lanes = current.lanes;

    workInProgress.child = current.child;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
    workInProgress.memoizedProps = current.memoizedProps;
    workInProgress.memoizedState = current.memoizedState;
    workInProgress.updateQueue = current.updateQueue;

    workInProgress.type = current.type;
  }
  return workInProgress;
}

export function createFiber(
  tag: WorkTag,
  pendingProps: any,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  return new FiberNode(tag, pendingProps, key, mode);
}

class FiberNode implements Fiber {
  tag: WorkTag;

  key: string | null;

  elementType = null;

  type = null;

  stateNode = null;

  return = null;

  child = null;

  sibling = null;

  index = 0;

  ref = null;

  pendingProps;
  memoizedProps = null;
  updateQueue = null;

  memoizedState = null;

  flags = NoFlags;
  subtreeFlags = NoFlags;
  deletions: Fiber[] | null = null;

  lanes = NoLanes;
  childLanes = NoLanes;

  alternate: Fiber | null = null;

  mode: number;

  constructor(
    tag: WorkTag,
    pendingProps: any,
    key: string | null,
    mode: TypeOfMode
  ) {
    this.tag = tag;
    this.key = key;
    this.pendingProps = pendingProps;
    this.mode = mode;
  }
}
