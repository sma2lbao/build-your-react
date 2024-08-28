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
import { REACT_CONTEXT_TYPE, REACT_ELEMENT_TYPE } from "shared/react-symbols";
import { ReactContext } from "shared/react-types";
import { readContextDuringReconciliation } from "./react-fiber-new-context";

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

      if (Array.isArray(newChild)) {
        const firstChild = reconcileChildrenArray(
          returnFiber,
          currentFirstChild,
          newChild,
          lanes
        );

        return firstChild;
      }

      if (newChild.$$typeof === REACT_CONTEXT_TYPE) {
        const context: ReactContext<any> = newChild;

        return reconcileChildFibersImpl(
          returnFiber,
          currentFirstChild,
          readContextDuringReconciliation(returnFiber, context, lanes),
          lanes
        );
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
          coerceRef(returnFiber, child, existing, element);
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
    coerceRef(returnFiber, currentFirstChild, created, element);
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

  /**
   * 数组
   * @param returnFiber wip
   * @param currentFirstChild 第一个子Fiber；存在sibling 可以遍历其他Fiber
   * @param newChildren ReactElement数组
   * @param lanes
   * @returns
   */
  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<any>,
    lanes: Lanes
  ): Fiber | null {
    // 数组的一般分为 增、删；
    // 备注：改为直接可复用。
    // 增：可以在 首 、中 、尾 插入
    // 删：可以在 首 、中 、尾 删除

    // 最新的第一个子Fiber
    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;
    // 取前段
    // 当存在 旧 fiber时，遍历 reactElement 数组
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      // 遇到旧fiber 位置在 reactElement 右边时（说明存在删除旧Fiber）停止遍历；
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        lanes
      );

      if (newFiber === null) {
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }

      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber);
        }
      }

      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // newChildren 长度比旧子fiber长度小或者相同且全都可以复用
    if (newIdx === newChildren.length) {
      // 标记其他旧fiber删除
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    // 取中端
    // 没有旧 fiber时（说明新的reactElement 比 旧fiber children 长）；创建新的Fiber
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }

      return resultingFirstChild;
    }

    // 还存在可以复用的旧fiber
    const existingChildren = mapRemainingChildren(oldFiber);

    // 取后端
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            );
          }
        }

        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }

        previousNewFiber = newFiber;
      }
    }

    // 更新阶段删除没有复用的节点
    if (shouldTrackSideEffects) {
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  function mapRemainingChildren(
    currentFirstChild: Fiber
  ): Map<string | number, Fiber> {
    const existingChildren: Map<string | number, Fiber> = new Map();

    let existingChild: null | Fiber = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    const key = oldFiber !== null ? oldFiber.key : null;

    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      if (key !== null) {
        return null;
      }
      return updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            const updated = updateElement(
              returnFiber,
              oldFiber,
              newChild,
              lanes
            );
            return updated;
          } else {
            return null;
          }
        }
      }

      if (Array.isArray(newChild)) {
        if (key !== null) {
          return null;
        }

        // TODO updateFragment
        throw new Error("TODO updateFragment");
      }

      if (newChild.$$typeof === REACT_CONTEXT_TYPE) {
        const context: ReactContext<any> = newChild;
        return updateSlot(
          returnFiber,
          oldFiber,
          readContextDuringReconciliation(returnFiber, context, lanes),
          lanes
        );
      }
    }

    return null;
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, "" + newChild, lanes);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null;

          const updated = updateElement(
            returnFiber,
            matchedFiber,
            newChild,
            lanes
          );

          return updated;
        }
      }

      if (Array.isArray(newChild)) {
        // TODO 支持 Fragment
        throw new Error(`TODO 支持 Fragment`);
      }

      if (newChild.$$typeof === REACT_CONTEXT_TYPE) {
        const context: ReactContext<any> = newChild;

        return updateFromMap(
          existingChildren,
          returnFiber,
          newIdx,
          readContextDuringReconciliation(returnFiber, context, lanes),
          lanes
        );
      }
    }

    return null;
  }

  function createChild(
    returnFiber: Fiber,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // 字符串和数字类型
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      const created = createFiberFromText(
        "" + newChild,
        returnFiber.mode,
        lanes
      );
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.mode,
            lanes
          );
          coerceRef(returnFiber, null, created, newChild);
          created.return = returnFiber;
          return created;
        }
      }

      if (Array.isArray(newChild)) {
        // TODO Fragment
      }

      if (newChild.$$typeof === REACT_CONTEXT_TYPE) {
        const context: ReactContext<any> = newChild;

        return createChild(
          returnFiber,
          readContextDuringReconciliation(returnFiber, context, lanes),
          lanes
        );
      }
    }

    return null;
  }

  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number
  ): number {
    newFiber.index = newIndex;

    if (!shouldTrackSideEffects) {
      return lastPlacedIndex;
    }

    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        return oldIndex;
      }
    } else {
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    }
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    lanes: Lanes
  ) {
    if (current === null || current.tag !== HostText) {
      const created = createFiberFromText(textContent, returnFiber.mode, lanes);
      created.return = returnFiber;

      return created;
    } else {
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;

      return existing;
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    const elementType = element.type;
    // TODO updateFragment

    // 更新
    if (current !== null) {
      if (current.elementType === elementType) {
        const existing = useFiber(current, element.props);
        coerceRef(returnFiber, current, existing, element);
        existing.return = returnFiber;

        return existing;
      }
    }

    const created = createFiberFromElement(element, returnFiber.mode, lanes);
    coerceRef(returnFiber, current, created, element);
    created.return = returnFiber;
    return created;
  }

  return reconcileChildFibers;
}

function coerceRef(
  returnFier: Fiber,
  current: Fiber | null,
  workInProgress: Fiber,
  element: ReactElement
): void {
  const refProp = element.props.ref;
  const ref = refProp !== undefined ? refProp : null;

  workInProgress.ref = ref;
}

export function cloneChildFibers(
  current: Fiber | null,
  worInProgress: Fiber
): void {
  if (current !== null && worInProgress.child !== current.child) {
    throw new Error("Resuming work not yet implemented.");
  }

  if (worInProgress.child === null) {
    return;
  }

  let currentChild = worInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  worInProgress.child = newChild;

  newChild.return = worInProgress;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    );
    newChild.return = worInProgress;
  }
  newChild.sibling = null;
}
