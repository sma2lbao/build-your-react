import {
  Container,
  Instance,
  appendChild,
  appendChildToContainer,
  commitUpdate,
  insertBefore,
  insertInContainerBefore,
  supportsMutation,
} from "react-fiber-config";
import {
  BeforeMutationMask,
  ChildDeletion,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  Placement,
  Update,
} from "./react-fiber-flags";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./react-work-tags";
import {
  HookFlags,
  Layout as HookLayout,
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  Insertion as HookInsertion,
} from "./react-hook-effect-tags";
import { FunctionComponentUpdateQueue } from "./react-fiber-hooks";

let nextEffect: Fiber | null = null;

export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
) {
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
}

function commitMutationEffectsOnFiber(
  finishedWork: Fiber,
  root: FiberRoot,
  lanes: Lanes
) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  switch (finishedWork.tag) {
    case HostRoot: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      return;
    }
    case FunctionComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        // 当前 fiber（函数组件）有更新标记
        try {
          commitHookEffectListUnmount(
            HookInsertion | HookHasEffect,
            finishedWork,
            finishedWork.return
          );
          commitHookEffectListMount(
            HookInsertion | HookHasEffect,
            finishedWork
          );
        } catch (error) {
          throw new Error(`captureCommitPhaseError`);
        }

        try {
          // 在 React 的更新阶段中，布局效果的销毁发生在突变阶段（mutation phase）。
          // 这样做的目的是确保所有组件的销毁函数都在创建函数之前被调用，以避免相互干扰。
          // 具体来说，一个组件的销毁函数不会覆盖另一个组件创建函数所设置的引用，
          // 从而保持组件的行为一致性。这样可以保证在同一提交过程中，不同组件之间的效果不会相互干扰。

          commitHookEffectListUnmount(
            HookLayout | HookHasEffect,
            finishedWork,
            finishedWork.return
          );
        } catch (error) {
          throw new Error(`captureCommitPhaseError`);
        }
      }

      return;
    }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      if (supportsMutation) {
        if (flags & Update) {
          const instance: Instance = finishedWork.stateNode;
          if (instance != null) {
            const newProps = finishedWork.memoizedProps;

            const oldProps =
              current !== null ? current.memoizedProps : newProps;
            const type = finishedWork.type;
            try {
              commitUpdate(instance, type, oldProps, newProps, finishedWork);
            } catch (error) {
              console.error(
                new Error(`
              HostComponent commitUpdate error
              `)
              );
            }
          }
        }
      }

      return;
    }

    case HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      return;
    }
    default: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      return;
    }
  }
}

export function commitBeforeMutationEffects(
  root: FiberRoot,
  firstChild: Fiber
): boolean {
  commitBeforeMutationEffects_begin();

  return false;
}

function commitBeforeMutationEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    const child = fiber.child;
    if (
      (fiber.subtreeFlags & BeforeMutationMask) !== NoFlags &&
      child !== null
    ) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitBeforeMutationEffects_complete();
    }
  }
}

function commitBeforeMutationEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    try {
      commitBeforeMutationEffectsOnFiber(fiber);
    } catch (error) {
      console.error(`commitBeforeMutationEffects_complete: `, fiber);
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitBeforeMutationEffectsOnFiber(finishedWork: Fiber) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  switch (finishedWork.tag) {
    case FunctionComponent: {
      break;
    }
    default:
      break;
  }
}

export function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  const current = finishedWork.alternate;

  commitLayoutEffectOnFiber(root, current, finishedWork, committedLanes);
}

function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  const flags = finishedWork.flags;

  switch (finishedWork.tag) {
    case HostRoot: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
      break;
    }
    case FunctionComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
      if (flags & Update) {
        commitHookLayoutEffects(finishedWork, HookLayout | HookHasEffect);
      }
      break;
    }
    case HostComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );

      if (current === null && flags & Update) {
        commitHostComponentMount(finishedWork);
      }

      break;
    }
    default: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
      break;
    }
  }
}

function recursivelyTraverseLayoutEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
) {
  if (parentFiber.subtreeFlags & LayoutMask) {
    let child = parentFiber.child;
    while (child !== null) {
      const current = child.alternate;
      commitLayoutEffectOnFiber(root, current, child, lanes);
      child = child.sibling;
    }
  }
}

function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
) {
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    // 更新阶段才会出现
  }

  if (parentFiber.subtreeFlags & MutationMask) {
    let child = parentFiber.child;

    while (child !== null) {
      // 深度优先遍历
      commitMutationEffectsOnFiber(child, root, lanes);
      child = child.sibling;
    }
  }
}

function commitReconciliationEffects(finishedWork: Fiber) {
  const flags = finishedWork.flags;
  if (flags & Placement) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
}

function commitPlacement(finishedWork: Fiber): void {
  const parentFiber = getHostParentFiber(finishedWork);

  switch (parentFiber.tag) {
    case HostComponent: {
      const parent: Instance = parentFiber.stateNode;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostRoot: {
      const parent: Container = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
      break;
    }
    default:
      throw new Error(
        "Invalid host parent fiber. This error is likely caused by a bug " +
          "in React. Please file an issue."
      );
  }
}

function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  const updateQueue: FunctionComponentUpdateQueue | null =
    finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // 卸载阶段
        const inst = effect.inst;
        const destory = inst.destory;
        if (destory !== undefined) {
          inst.destory = undefined;
          // 调用 副作用钩子函数 的 返回函数
          safelyCallDestory(finishedWork, nearestMountedAncestor, destory);
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

function commitHookLayoutEffects(finishedWork: Fiber, hookFlags: HookFlags) {
  try {
    commitHookEffectListMount(hookFlags, finishedWork);
  } catch (error) {
    console.error("commitHookLayoutEffects: ", error);
  }
}

function commitHostComponentMount(finishedWork: Fiber) {}

function commitHookEffectListMount(flags: HookFlags, finishedWork: Fiber) {
  const updateQueue: FunctionComponentUpdateQueue | null =
    finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // 渲染阶段
        const create = effect.create;
        const inst = effect.inst;
        // 执行 useEffect 传入函数
        const destory = create();
        inst.destory = destory;
      }

      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

export function commitPassiveUnmountEffects(finishedWork: Fiber): void {
  commitPassiveUnmountOnFiber(finishedWork);
}

function commitPassiveUnmountOnFiber(finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      if (finishedWork.flags & Passive) {
        commitHookPassiveUnmountEffects(
          finishedWork,
          finishedWork.return,
          HookPassive | HookHasEffect
        );
      }
      break;
    }
    default: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      break;
    }
  }
}

function recursivelyTraversePassiveUnmountEffects(parentFiber: Fiber): void {
  const deletions = parentFiber.deletions;

  if ((parentFiber.flags & ChildDeletion) !== NoFlags) {
    // TODO 删除
    // if (deletions !== null) {
    //   for (let i = 0; i < deletions.length; i++) {
    //     const childToDelete = deletions[i];
    //     nextEffect = childToDelete;
    //     commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
    //       childToDelete,
    //       parentFiber
    //     );
    //   }
    // }
    // detachAlternateSiblings(parentFiber);
  }

  if (parentFiber.subtreeFlags & PassiveMask) {
    let child = parentFiber.child;
    while (child !== null) {
      commitPassiveUnmountOnFiber(child);

      child = child.sibling;
    }
  }
}

function commitHookPassiveUnmountEffects(
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null,
  hookFlags: HookFlags
) {
  commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor);
}

export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  commitPassiveMountOnFiber(root, finishedWork, committedLanes);
}

function commitPassiveMountOnFiber(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent: {
      recursivelyTraversePassiveMountEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );

      if (flags & Passive) {
        commitHookPassiveMountEffects(
          finishedWork,
          HookPassive | HookHasEffect
        );
      }
      break;
    }
    default: {
      recursivelyTraversePassiveMountEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
    }
  }
}

function recursivelyTraversePassiveMountEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  committedLanes: Lanes
) {
  if (parentFiber.subtreeFlags & PassiveMask) {
    let child = parentFiber.child;

    while (child !== null) {
      commitPassiveMountOnFiber(root, child, committedLanes);

      child = child.sibling;
    }
  }
}

function commitHookPassiveMountEffects(
  finishedWork: Fiber,
  hookFlags: HookFlags
) {
  try {
    commitHookEffectListMount(hookFlags, finishedWork);
  } catch (error) {
    throw new Error("captureCommitPhaseError");
  }
}

/**
 * 获取上级最近的原生fiber组件。用来插入真实dom
 * @param fiber
 * @returns
 */
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  throw new Error(
    "Expected to find a host parent. This error is likely caused by a bug " +
      "in React. Please file an issue."
  );
}

function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

function getHostSibling(fiber: Fiber): Instance | null {
  let node = fiber;

  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.flags & Placement) {
        continue siblings;
      }
      if (node.child === null) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}

function insertOrAppendPlacementNode(
  node: Fiber,
  before: Instance | null,
  parent: Instance
): void {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before: Instance | null,
  parent: Container
): void {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertInContainerBefore(parent, stateNode, before);
    } else {
      appendChildToContainer(parent, stateNode);
    }
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function safelyCallDestory(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destory: () => void
) {
  try {
    destory();
  } catch (error) {
    throw new Error(`captureCommitPhaseError`);
  }
}
