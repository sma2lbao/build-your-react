import {
  REACT_CONSUMER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
  REACT_SUSPENSE_TYPE,
} from "shared/react-symbols";
import { NoFlags, Placement } from "./react-fiber-flags";
import { Lanes, NoLanes } from "./react-fiber-lane";
import { Dependencies, Fiber } from "./react-internal-types";
import {
  ConcurrentMode,
  StrictEffectsMode,
  StrictLegacyMode,
  TypeOfMode,
} from "./react-type-of-mode";
import {
  ContextConsumer,
  ContextProvider,
  ForwardRef,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  LazyComponent,
  MemoComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag,
} from "./react-work-tags";
import { ReactElement } from "shared/react-element-type";
import { ReactFragment } from "shared/react-types";
import {
  OffscreenInstance,
  OffscreenProps,
  OffscreenVisible,
} from "./react-fiber-activity-component";
import {
  attachOffscreenInstance,
  detachOffscreenInstance,
} from "./react-fiber-commit-work";

export function createHostRootFiber(): Fiber {
  let mode = ConcurrentMode;

  mode |= StrictLegacyMode | StrictEffectsMode;

  return createFiber(HostRoot, null, null, mode);
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromOffscreen(
  pendingProps: OffscreenProps,
  mode: TypeOfMode,
  lanes: Lanes,
  key: string | null
): Fiber {
  const fiber = createFiber(OffscreenComponent, pendingProps, key, mode);
  fiber.elementType = REACT_OFFSCREEN_TYPE;
  fiber.lanes = lanes;
  const primaryChildInstance: OffscreenInstance = {
    _visibility: OffscreenVisible,
    _pendingVisibility: OffscreenVisible,
    _current: null,
    detach: () => detachOffscreenInstance(primaryChildInstance),
    attach: () => attachOffscreenInstance(primaryChildInstance),
  };
  fiber.stateNode = primaryChildInstance;
  return fiber;
}

export function createFiberFromSuspense(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: string | null
): Fiber {
  const fiber = createFiber(SuspenseComponent, pendingProps, key, mode);
  fiber.elementType = REACT_SUSPENSE_TYPE;
  fiber.lanes = lanes;
  return fiber;
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
  if (typeof type === "function") {
  } else if (typeof type === "string") {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, mode, lanes, key);
      case REACT_OFFSCREEN_TYPE:
        return createFiberFromOffscreen(pendingProps, mode, lanes, key);
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, mode, lanes, key);
      default: {
        if (typeof type === "object" && type !== null) {
          switch (type.$$typeof) {
            case REACT_CONTEXT_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            case REACT_CONSUMER_TYPE:
              fiberTag = ContextConsumer;
              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              break getTag;
          }
        }

        const typeString = type === null ? "null" : typeof type;
        resolvedType = null;
        throw new Error(
          "Element type is invalid: expected a string (for built-in " +
            "components) or a class/function (for composite components) " +
            `but got: ${typeString}`
        );
      }
    }
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

  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          lanes: currentDependencies.lanes,
          firstContext: currentDependencies.firstContext,
        };

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

    workInProgress.dependencies = null;

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

    const currentDependencies = current.dependencies;
    workInProgress.dependencies =
      currentDependencies === null
        ? null
        : {
            lanes: currentDependencies.lanes,
            firstContext: currentDependencies.firstContext,
          };
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
  dependencies: Dependencies | null = null;

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

export function isSimpleFunctionComponent(type: any): boolean {
  return (
    typeof type === "function" &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  );
}

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}
