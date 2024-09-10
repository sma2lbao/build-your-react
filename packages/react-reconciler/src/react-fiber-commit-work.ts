import {
  Container,
  Instance,
  TextInstance,
  appendChild,
  appendChildToContainer,
  commitTextUpdate,
  commitUpdate,
  detachDeletedInstance,
  getPublicInstance,
  hideInstance,
  insertBefore,
  insertInContainerBefore,
  removeChild,
  removeChildFromContainer,
  resetTextContent,
  supportsMutation,
  unhideInstance,
} from "react-fiber-config";
import {
  BeforeMutationMask,
  ChildDeletion,
  ContentReset,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  Placement,
  Ref,
  Update,
  Visibility,
} from "./react-fiber-flags";
import { Lanes, SyncLane } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  MemoComponent,
  OffscreenComponent,
  SimpleMemoComponent,
  SuspenseComponent,
} from "./react-work-tags";
import {
  HookFlags,
  NoFlags as NoHookEffect,
  Layout as HookLayout,
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  Insertion as HookInsertion,
} from "./react-hook-effect-tags";
import { FunctionComponentUpdateQueue } from "./react-fiber-hooks";
import {
  OffscreenDetached,
  OffscreenInstance,
  OffscreenPassiveEffectsConnected,
  OffscreenProps,
  OffscreenState,
  OffscreenVisible,
  isOffscreenManual,
} from "./react-fiber-activity-component";
import {
  markCommitTimeOfFallback,
  resolveRetryWakeable,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import { enqueueConcurrentRenderForLane } from "./react-fiber-concurrent-updates";
import { RetryQueue } from "./react-fiber-suspense-component";

/**
 * 下一个有副作用的Fiber
 */
let nextEffect: Fiber | null = null;

/**
 * 用来删除fiber所需的原生父节点
 */
let hostParent: Instance | Container | null = null;
/**
 * 用来标识是否是 react container节点 。（id=root的节点）
 */
let hostParentIsContainer: boolean = false;

let offscreenSubtreeIsHidden = false;
let offscreenSubtreeWasHidden = false;

/**
 * commit 阶段 mutation 阶段入口
 * @param root
 * @param finishedWork
 * @param committedLanes
 */
export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
) {
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
}

/**
 * mutation阶段具体实现
 * @param finishedWork
 * @param root
 * @param lanes
 * @returns
 */
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
    case MemoComponent:
    case SimpleMemoComponent:
    case FunctionComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      // 到达这里说明真实dom已经挂载到父宿主节点上了，但不一定加入document上（父fiber也可能是Placement）
      // 主要处理 effect 相关
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

      if (flags & Ref) {
        if (current !== null) {
          safelyDetachRef(current);
        }
      }

      if (supportsMutation) {
        if (finishedWork.flags & ContentReset) {
          const instance: Instance = finishedWork.stateNode;
          try {
            resetTextContent(instance);
          } catch (error) {
            throw new Error(`captureCommitPhaseError`);
          }
        }

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

      if (flags & Update) {
        if (supportsMutation) {
          if (finishedWork.stateNode === null) {
            throw new Error(
              "This should have a text node initialized. This error is likely " +
                "caused by a bug in React. Please file an issue."
            );
          }

          const textInstance: TextInstance = finishedWork.stateNode;
          const newText: string = finishedWork.memoizedProps;
          const oldText: string =
            current !== null ? current.memoizedProps : newText;

          try {
            commitTextUpdate(textInstance, oldText, newText);
          } catch (error) {
            throw new Error(`captureCommitPhaseError`);
          }
        }
      }

      return;
    }
    case OffscreenComponent: {
      if (flags & Ref) {
        if (current !== null) {
          safelyDetachRef(current);
        }
      }

      const newState: OffscreenState | null = finishedWork.memoizedState;
      const isHidden = newState !== null;
      const wasHidden = current !== null && current.memoizedState !== null;

      const prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
      const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;

      offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || isHidden;
      offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;

      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;

      commitReconciliationEffects(finishedWork);

      const offscreenInstance: OffscreenInstance = finishedWork.stateNode;

      offscreenInstance._current = finishedWork;
      offscreenInstance._visibility &= ~OffscreenDetached;
      offscreenInstance._visibility |=
        offscreenInstance._pendingVisibility & OffscreenDetached;

      if (flags & Visibility) {
        if (isHidden) {
          offscreenInstance._visibility &= ~OffscreenVisible;
        } else {
          offscreenInstance._visibility |= OffscreenVisible;
        }

        if (isHidden) {
          const isUpdate = current !== null;
          const wasHiddenByAncestorOffscreen =
            offscreenSubtreeIsHidden || offscreenSubtreeWasHidden;
          if (isUpdate && !wasHidden && !wasHiddenByAncestorOffscreen) {
            // 重新隐藏
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
          }
        } else {
        }
        if (supportsMutation && !isOffscreenManual(finishedWork)) {
          hideOrUnhideAllChildren(finishedWork, isHidden);
        }
      }

      if (flags & Update) {
        // TODO
      }

      return;
    }
    case SuspenseComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      const offscreenFiber = finishedWork.child!;
      if (offscreenFiber.flags & Visibility) {
        const isShowingFallback = finishedWork.memoizedState !== null;
        const wasShowingFallback =
          current !== null && current.memoizedState !== null;
        if (isShowingFallback !== wasShowingFallback) {
          markCommitTimeOfFallback();
        }
      }

      if (flags & Update) {
        const retryQueue: RetryQueue | null = finishedWork.updateQueue;
        if (retryQueue !== null) {
          finishedWork.updateQueue = null;
          attachSuspenseRetryListeners(finishedWork, retryQueue);
        }
      }
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
    case SimpleMemoComponent:
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

      if (flags & Ref) {
        safelyAttachRef(finishedWork);
      }

      break;
    }
    case OffscreenComponent: {
      const isHidden = finishedWork.memoizedState !== null;
      const newOffscreenSubtreeIsHidden = isHidden || offscreenSubtreeIsHidden;
      if (newOffscreenSubtreeIsHidden) {
        // 隐藏不用处理
      } else {
        // 可见状态
        const wasHidden = current !== null && current.memoizedState !== null;
        const newOffscreenSubtreeWasHidden =
          wasHidden || offscreenSubtreeWasHidden;
        const prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
        const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
        offscreenSubtreeIsHidden = newOffscreenSubtreeIsHidden;
        offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden;

        if (offscreenSubtreeIsHidden && !prevOffscreenSubtreeWasHidden) {
          // 这是重新出现的边界的根。当我们继续遍历布局效果时，我们还必须重新挂载在Offscreen子树隐藏时卸载的布局效果。这是普通commitlayouteeffects的超集。
          const includeWorkInProgressEffects =
            (finishedWork.subtreeFlags & LayoutMask) !== NoFlags;
          // TODO
          throw new Error("includeWorkInProgressEffects");
        } else {
          recursivelyTraverseLayoutEffects(
            finishedRoot,
            finishedWork,
            committedLanes
          );
        }
        offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      }

      if (flags & Ref) {
        const props: OffscreenProps = finishedWork.memoizedProps;
        if (props.mode === "manual") {
          safelyAttachRef(finishedWork);
        } else {
          safelyDetachRef(finishedWork);
        }
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

/**
 * mutation阶段的递归遍历
 * 主要处理 deletions 及 MutationMask 的 fiber 节点
 * 以及向child递归
 * @param root
 * @param parentFiber
 * @param lanes
 */
function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
) {
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    // 更新阶段才会出现
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      try {
        commitDeletionEffects(root, parentFiber, childToDelete);
      } catch (error) {
        throw new Error(`captureCommitPhaseError`);
      }
    }
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

function recursivelyTraverseDisappearLayoutEffects(parentFiber: Fiber) {
  let child = parentFiber.child;
  while (child !== null) {
    disappearLayoutEffects(child);
    child = child.sibling;
  }
}

/**
 * 处理 Placement fiber 标记。主要是真实dom的插入
 * @param finishedWork
 */
function commitReconciliationEffects(finishedWork: Fiber) {
  const flags = finishedWork.flags;
  if (flags & Placement) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
}

/**
 * 提交当前 fiber 的真实dom。即将dom加入到真实的文档中
 * 叶子节点的fiber最先进入
 * 当到达HostRoot fiber 说明所有的placement的fiber节点都加入文档中了
 * @param finishedWork
 */
function commitPlacement(finishedWork: Fiber): void {
  // 获取祖先宿主组件，比如div对应fiber
  const parentFiber = getHostParentFiber(finishedWork);

  switch (parentFiber.tag) {
    case HostComponent: {
      const parent: Instance = parentFiber.stateNode;

      // 处理文本修改
      if (parentFiber.flags & ContentReset) {
        resetTextContent(parent);
        parentFiber.flags &= ~ContentReset;
      }

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
        const destroy = inst.destroy;
        if (destroy !== undefined) {
          inst.destroy = undefined;
          // 调用 副作用钩子函数 的 返回函数
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
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
        const destroy = create();
        inst.destroy = destroy;
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
    case SimpleMemoComponent:
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
    case OffscreenComponent: {
      const instance: OffscreenInstance = finishedWork.stateNode;
      const nextState: OffscreenState | null = finishedWork.memoizedState;

      const isHidden = nextState !== null;

      if (
        isHidden &&
        instance._visibility & OffscreenPassiveEffectsConnected &&
        (finishedWork.return === null ||
          finishedWork.return.tag !== SuspenseComponent)
      ) {
        instance._visibility &= ~OffscreenPassiveEffectsConnected;
        recursivelyTraverseDisconnectPassiveEffects(finishedWork);
      } else {
        recursivelyTraversePassiveUnmountEffects(finishedWork);
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
    if (deletions !== null) {
      for (let i = 0; i < deletions.length; i++) {
        const childToDelete = deletions[i];
        nextEffect = childToDelete;
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
          childToDelete,
          parentFiber
        );
      }
    }
    detachAlternateSiblings(parentFiber);
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
    case SimpleMemoComponent:
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
    case OffscreenComponent: {
      const instance: OffscreenInstance = finishedWork.stateNode;
      const nextState: OffscreenState | null = finishedWork.memoizedState;

      const isHidden = nextState !== null;

      if (!isHidden) {
        if (instance._visibility & OffscreenPassiveEffectsConnected) {
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes
          );
        } else {
          // TODO Cache
        }
      } else {
        if (instance._visibility & OffscreenPassiveEffectsConnected) {
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes
          );
        } else {
          instance._visibility |= OffscreenPassiveEffectsConnected;

          const includeWorkInProgressEffects =
            (finishedWork.subtreeFlags & PassiveMask) !== NoFlags;

          recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            includeWorkInProgressEffects
          );
        }
      }

      if (flags & Passive) {
        const current = finishedWork.alternate;
        commitOffscreenPassiveMountEffects(current, finishedWork, instance);
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

function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current: Fiber,
  nearestMountedAncestor: Fiber | null
): void {
  switch (current.tag) {
    case SimpleMemoComponent:
    case FunctionComponent: {
      commitHookPassiveUnmountEffects(
        current,
        nearestMountedAncestor,
        HookPassive
      );
      break;
    }
    case OffscreenComponent: {
      // TODO cache
      break;
    }
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);

    const child = fiber.child;

    if (child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
        deletedSubtreeRoot
      );
    }
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
  deletedSubtreeRoot: Fiber
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const sibling = fiber.sibling;
    const returnFiber = fiber.return;

    detachFiberAfterEffects(fiber);
    if (fiber === deletedSubtreeRoot) {
      nextEffect = null;
      return;
    }

    if (sibling !== null) {
      sibling.return = returnFiber;
      nextEffect = sibling;
      return;
    }

    nextEffect = returnFiber;
  }
}

function recursivelyTraverseReconnectPassiveEffects(
  finishedRoot: FiberRoot,
  parentFiber: Fiber,
  committedLanes: Lanes,
  includeWorkInProgressEffects: boolean
) {
  const childShouldIncludeWorkInProgressEffects =
    includeWorkInProgressEffects &&
    (parentFiber.subtreeFlags & PassiveMask) !== NoFlags;

  let child = parentFiber.child;
  while (child !== null) {
    reconnectPassiveEffects(
      finishedRoot,
      child,
      committedLanes,
      childShouldIncludeWorkInProgressEffects
    );
    child = child.sibling;
  }
}

function recursivelyTraverseDisconnectPassiveEffects(parentFiber: Fiber): void {
  const deletions = parentFiber.deletions;

  if ((parentFiber.flags & ChildDeletion) !== NoFlags) {
    if (deletions !== null) {
      for (let i = 0; i < deletions.length; i++) {
        const childToDelete = deletions[i];
        nextEffect = childToDelete;
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
          childToDelete,
          parentFiber
        );
      }
    }
    detachAlternateSiblings(parentFiber);
  }

  let child = parentFiber.child;
  while (child !== null) {
    disconnectPassiveEffect(child);
    child = child.sibling;
  }
}

function commitOffscreenPassiveMountEffects(
  current: Fiber | null,
  finishedWork: Fiber,
  instance: OffscreenInstance
) {
  // TODO cache
}

export function reconnectPassiveEffects(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  includeWorkInProgressEffects: boolean
) {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent:
    case SimpleMemoComponent: {
      recursivelyTraverseReconnectPassiveEffects(
        finishedRoot,
        finishedWork,
        committedLanes,
        includeWorkInProgressEffects
      );
      commitHookPassiveMountEffects(finishedWork, HookPassive);
      break;
    }
    case OffscreenComponent: {
      const instance: OffscreenInstance = finishedWork.stateNode;
      const nextState: OffscreenState | null = finishedWork.memoizedState;

      const isHidden = nextState !== null;

      if (isHidden) {
        if (instance._visibility & OffscreenPassiveEffectsConnected) {
          recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            includeWorkInProgressEffects
          );
        } else {
          // TODO cache
        }
      } else {
        instance._visibility |= OffscreenPassiveEffectsConnected;
        recursivelyTraverseReconnectPassiveEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          includeWorkInProgressEffects
        );
      }

      if (includeWorkInProgressEffects && flags & Passive) {
        const current: Fiber | null = finishedWork.alternate;
        commitOffscreenPassiveMountEffects(current, finishedWork, instance);
      }
      break;
    }
    default:
      recursivelyTraverseReconnectPassiveEffects(
        finishedRoot,
        finishedWork,
        committedLanes,
        includeWorkInProgressEffects
      );
      break;
  }
}

export function disconnectPassiveEffect(finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case SimpleMemoComponent: {
      commitHookPassiveUnmountEffects(
        finishedWork,
        finishedWork.return,
        HookPassive
      );
      recursivelyTraverseDisconnectPassiveEffects(finishedWork);
      break;
    }
    case OffscreenComponent: {
      const instance: OffscreenInstance = finishedWork.stateNode;
      if (instance._visibility & OffscreenPassiveEffectsConnected) {
        instance._visibility &= ~OffscreenPassiveEffectsConnected;
        recursivelyTraverseDisconnectPassiveEffects(finishedWork);
      } else {
      }
      break;
    }
    default:
      recursivelyTraverseDisconnectPassiveEffects(finishedWork);
      break;
  }
}

function detachFiberAfterEffects(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    fiber.alternate = null;
    detachFiberAfterEffects(alternate);
  }

  fiber.child = null;
  fiber.deletions = null;
  fiber.sibling = null;

  if (fiber.tag === HostComponent) {
    const hostInstance: Instance = fiber.stateNode;
    if (hostInstance !== null) {
      detachDeletedInstance(hostInstance);
    }
  }

  fiber.stateNode = null;

  fiber.return = null;
  fiber.dependencies = null;
  fiber.memoizedProps = null;
  fiber.memoizedState = null;
  fiber.pendingProps = null;
  fiber.stateNode = null;
  fiber.updateQueue = null;
}

function detachAlternateSiblings(parentFiber: Fiber) {
  const previousFiber = parentFiber.alternate;
  if (previousFiber !== null) {
    let detachedChild = previousFiber.child;
    if (detachedChild !== null) {
      previousFiber.child = null;
      do {
        const detachedSibling: Fiber | null = detachedChild.sibling;
        detachedChild.sibling = null;
        detachedChild = detachedSibling;
      } while (detachedChild !== null);
    }
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

function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }

    ref.current = instanceToUse;
  }
}

function safelyCallDestroy(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destroy: () => void
) {
  try {
    destroy();
  } catch (error) {
    throw new Error(`captureCommitPhaseError`);
  }
}

function safelyAttachRef(current: Fiber) {
  try {
    commitAttachRef(current);
  } catch (error) {
    throw new Error(`captureCommitPhaseError`);
  }
}

function safelyDetachRef(current: Fiber) {
  const ref = current.ref;

  if (ref !== null) {
    ref.current = null;
  }
}

function commitDeletionEffects(
  root: FiberRoot,
  returnFiber: Fiber,
  deletedFiber: Fiber
) {
  if (supportsMutation) {
    let parent: Fiber | null = returnFiber;
    findParent: while (parent !== null) {
      switch (parent.tag) {
        case HostComponent: {
          hostParent = parent.stateNode;
          hostParentIsContainer = false;
          break findParent;
        }
        case HostRoot: {
          hostParent = parent.stateNode.containerInfo;
          hostParentIsContainer = true;
          break findParent;
        }
      }
      parent = parent.return;
    }

    if (hostParent === null) {
      throw new Error(
        "Expected to find a host parent. This error is likely caused by " +
          "a bug in React. Please file an issue."
      );
    }

    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);

    // 重置
    hostParent = null;
    hostParentIsContainer = false;
  }

  detachFiberMutation(deletedFiber);
}

function detachFiberMutation(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.return = null;
  }
  fiber.return = null;
}

function commitDeletionEffectsOnFiber(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  deletedFiber: Fiber
) {
  switch (deletedFiber.tag) {
    case HostComponent: {
      safelyDetachRef(deletedFiber);
      // 需要到 HostText case 中
    }
    case HostText: {
      if (supportsMutation) {
        const prevHostParent = hostParent;
        const prevHostParentIsContainer = hostParentIsContainer;
        hostParent = null;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;

        if (hostParent !== null) {
          if (hostParentIsContainer) {
            removeChildFromContainer(hostParent, deletedFiber.stateNode);
          } else {
            removeChild(hostParent as any, deletedFiber.stateNode);
          }
        }
      }
      return;
    }
    case MemoComponent:
    case SimpleMemoComponent:
    case FunctionComponent: {
      // 非离屏下类似 vue keep-alive
      // 找到需要执行 destroy 回调函数的hook
      const updateQueue: FunctionComponentUpdateQueue | null =
        deletedFiber.updateQueue;
      if (updateQueue !== null) {
        const lastEffect = updateQueue.lastEffect;
        if (lastEffect !== null) {
          const firstEffect = lastEffect.next;

          let effect = firstEffect;
          do {
            const tag = effect.tag;
            const inst = effect.inst;
            const destroy = inst.destroy;
            if (destroy !== undefined) {
              if ((tag & HookInsertion) !== NoHookEffect) {
                inst.destroy = undefined;
                safelyCallDestroy(
                  deletedFiber,
                  nearestMountedAncestor,
                  destroy
                );
              } else if ((tag & HookLayout) !== NoHookEffect) {
                inst.destroy = undefined;
                safelyCallDestroy(
                  deletedFiber,
                  nearestMountedAncestor,
                  destroy
                );
              }
            }
            effect = effect.next;
          } while (effect !== firstEffect);
        }
      }

      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      return;
    }
    case OffscreenComponent: {
      safelyDetachRef(deletedFiber);
      const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
      offscreenSubtreeWasHidden =
        prevOffscreenSubtreeWasHidden || deletedFiber.memoizedState !== null;

      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );

      offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      break;
    }
    default: {
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      return;
    }
  }
}

function recursivelyTraverseDeletionEffects(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  parent: Fiber
) {
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
    child = child.sibling;
  }
}

function hideOrUnhideAllChildren(finishedWork: Fiber, isHidden: boolean) {
  let hostSubtreeRoot = null;
  if (supportsMutation) {
    let node: Fiber = finishedWork;
    while (true) {
      if (node.tag === HostComponent) {
        if (hostSubtreeRoot === null) {
          hostSubtreeRoot = node;
          try {
            const instance = node.stateNode;
            if (isHidden) {
              hideInstance(instance);
            } else {
              unhideInstance(node.stateNode, node.memoizedProps);
            }
          } catch (error) {
            throw new Error(`captureCommitPhaseError`);
          }
        }
      } else if (node.tag === HostText) {
        if (hostSubtreeRoot === null) {
          try {
            const instance = node.stateNode;
            if (isHidden) {
              hideInstance(instance);
            } else {
              unhideInstance(instance, node.memoizedProps);
            }
          } catch (error) {
            throw new Error(`captureCommitPhaseError`);
          }
        }
      } else if (
        node.tag === OffscreenComponent &&
        node.memoizedState !== null &&
        node !== finishedWork
      ) {
        // 需要隐藏的嵌套的Offscreen
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }

      if (node === finishedWork) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === finishedWork) {
          return;
        }

        if (hostSubtreeRoot === node) {
          hostSubtreeRoot = null;
        }

        node = node.return;
      }

      if (hostSubtreeRoot === node) {
        hostSubtreeRoot = null;
      }

      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
}

/**
 * 离屏组件失活
 * @param instance
 */
export function detachOffscreenInstance(instance: OffscreenInstance): void {
  const fiber = instance._current;

  if (fiber === null) {
    throw new Error(
      "Calling Offscreen.detach before instance handle has been set."
    );
  }

  if ((instance._pendingVisibility & OffscreenDetached) !== NoFlags) {
    // 如果有 OffscreenDetached 标识，代表已经触发过该回调
    return;
  }
  // 用 SyncLane 同步优先级调度更新
  const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
  if (root !== null) {
    instance._pendingVisibility |= OffscreenDetached;
    scheduleUpdateOnFiber(root, fiber, SyncLane);
  }
}

/**
 * 离屏组件激活
 * @param instance
 */
export function attachOffscreenInstance(instance: OffscreenInstance): void {
  const fiber = instance._current;
  if (fiber === null) {
    throw new Error(
      "Calling Offscreen.detach before instance handle has been set."
    );
  }

  if ((instance._pendingVisibility & OffscreenDetached) === NoFlags) {
    // 如果没有 OffscreenDetached 标识代表已经触发过该回调
    return;
  }

  const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
  if (root !== null) {
    instance._pendingVisibility &= ~OffscreenDetached;
    scheduleUpdateOnFiber(root, fiber, SyncLane);
  }
}

export function disappearLayoutEffects(finishedWork: Fiber) {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case MemoComponent:
    case SimpleMemoComponent: {
      commitHookEffectListUnmount(
        HookLayout,
        finishedWork,
        finishedWork.return
      );
      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
    }
    case HostComponent: {
      safelyDetachRef(finishedWork);
      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
    }
    case OffscreenComponent: {
      safelyDetachRef(finishedWork);

      const isHidden = finishedWork.memoizedState !== null;
      if (!isHidden) {
      } else {
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
      }
      break;
    }
    default:
      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
  }
}

function attachSuspenseRetryListeners(
  finishedWork: Fiber,
  wakeables: RetryQueue
) {
  // 如果这个边界刚刚超时，那么它将有一组可唤醒对象。
  // 对于每个可唤醒对象，附加一个侦听器，以便当它解析时，
  // React尝试以主(超时前)状态重新呈现边界。
  const retryCache = getRetryCache(finishedWork);
  wakeables.forEach((wakeable) => {
    const retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
    if (!retryCache.has(wakeable)) {
      retryCache.add(wakeable);

      wakeable.then(retry, retry);
    }
  });
}

function getRetryCache(finishedWork: Fiber) {
  switch (finishedWork.tag) {
    case SuspenseComponent: {
      let retryCache = finishedWork.stateNode;
      if (retryCache === null) {
        retryCache = finishedWork.stateNode = new WeakSet();
      }
      return retryCache;
    }
    default: {
      throw new Error(
        `Unexpected Suspense handler tag (${finishedWork.tag}). This is a ` +
          "bug in React."
      );
    }
  }
}
