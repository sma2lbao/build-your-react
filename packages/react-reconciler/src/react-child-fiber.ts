import { ReactElement } from "shared/react-element-type";
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from "./react-fiber";
import { ChildDeletion, Placement } from "./react-fiber-flags";
import { Lanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";
import { HostText } from "./react-work-tags";
import { REACT_ELEMENT_TYPE } from "shared/react-symbols";

type ChildReconciler = (
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any,
  lanes: Lanes
) => Fiber | null;

export const mountChildFibers: ChildReconciler = createChildReconciler(false);

export const reconcileChildFibers: ChildReconciler =
  createChildReconciler(true);

/**
 *
 * @param shouldTrackSideEffects 是否追踪副作用
 */
function createChildReconciler(
  shouldTrackSideEffects: boolean
): ChildReconciler {
  /**
   * 待返回的函数
   */
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    const firstChildFiber = reconcileChildFibersImpl(
      returnFiber,
      currentFirstChild,
      newChild,
      lanes
    );
    return firstChildFiber;
  }

  function reconcileChildFibersImpl(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const firstChild = placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            )
          );
          return firstChild;
        }
      }
    }
    if (
      typeof newChild === "number" ||
      typeof newChild === "bigint" ||
      (typeof newChild === "string" && newChild !== "")
    ) {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          "" + newChild,
          lanes
        )
      );
    }

    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }

    return newFiber;
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild;
    // 判断 key 是否一致来判断是否可复用
    while (child !== null) {
      if (child.key === key) {
        const elementType = element.type;
        if (child.elementType === elementType) {
          // 单节点删除其他兄弟节点
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, element.props);
          existing.return = returnFiber;
          return existing;
        }

        // 都没有匹配
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }

      child = child.sibling;
    }

    const created = createFiberFromElement(element, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    lanes: Lanes
  ): Fiber {
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }

    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(textContent, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null
  ): null {
    if (!shouldTrackSideEffects) {
      return null;
    }

    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  /**
   * 更新阶段，给父fiber打上 ChildDeletion 的标记
   * @param returnFiber
   * @param childToDelete
   * @returns
   */
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      return;
    }

    const deletions = returnFiber.deletions;

    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function useFiber(fiber: Fiber, pendingProps: any): Fiber {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  return reconcileChildFibers;
}
