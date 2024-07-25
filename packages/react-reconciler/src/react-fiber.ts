import { NoFlags } from "./react-fiber-flags";
import { NoLanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";
import {
  ConcurrentMode,
  StrictEffectsMode,
  StrictLegacyMode,
  TypeOfMode,
} from "./react-type-of-mode";
import { HostRoot, WorkTag } from "./react-work-tags";

export function createHostRootFiber(): Fiber {
  let mode = ConcurrentMode;

  mode |= StrictLegacyMode | StrictEffectsMode;

  return createFiber(HostRoot, null, null, mode);
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
