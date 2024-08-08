import { FiberRoot } from "./react-internal-types";

export type Lane = number;

export type Lanes = number;

export const TotalLanes = 31;

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;

const NonIdleLanes: Lanes = 0b0000111111111111111111111111111;

/**
 * 同步任务
 */
export const SyncLane: Lane = 0b0000000000000000000000000000010;

/**
 * 连续输入任务-（如：文本框输入事件）
 */
export const InputContinuousLane: Lane = 0b0000000000000000000000000001000;

/**
 * 默认任务
 */
export const DefaultLane: Lane = 0b0000000000000000000000000100000;

/**
 * 空闲阶段任务
 */
export const IdleLane: Lane = 0b0010000000000000000000000000000;

export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) return NoLanes;

  let nextLanes: Lanes = NoLanes;

  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;

  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;

  if (nonIdlePendingLanes !== NoLanes) {
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
    } else {
      const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
      }
    }
  } else {
    const unblockedLanes = pendingLanes & ~suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(unblockedLanes);
    } else {
      if (pingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(pingedLanes);
      }
    }
  }

  // if (nextLanes === NoLane) {
  //   // 挂起时
  //   return NoLanes;
  // }

  // if (wipLanes !== NoLanes && wipLanes !== nextLanes && (wipLanes & suspendedLanes) === NoLanes) {

  // }

  return nextLanes;
}

export function markRootFinished(root: FiberRoot, remainingLanes: Lanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;

  root.pendingLanes = remainingLanes;

  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;

  root.expiredLanes &= remainingLanes;

  root.entangledLanes &= remainingLanes;

  let lanes = noLongerPendingLanes;

  // while (lanes > 0) {
  //   const index = pickArbitraryLaneIndex(lanes);
  //   const lane = 1 << index;

  //   lanes &= ~lane;
  // }
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function markRootUpdated(root: FiberRoot, updateLane: Lane) {
  root.pendingLanes |= updateLane;

  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }
}

export function includesSyncLane(lanes: Lanes): boolean {
  return (lanes & SyncLane) !== NoLanes;
}

export function includesNonIdleWork(lanes: Lanes): boolean {
  return (lanes & NonIdleLanes) !== NoLanes;
}

export function includesExpiredLane(root: FiberRoot, lanes: Lanes): boolean {
  return (lanes & root.expiredLanes) !== NoLanes;
}

export function includesBlockingLane(root: FiberRoot, lanes: Lanes): boolean {
  const SyncDefaultLanes = InputContinuousLane | DefaultLane;

  return (lanes & SyncDefaultLanes) !== NoLanes;
}

/**
 * 合并优先级通道
 * @param a
 * @param b
 * @returns
 */
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}

/**
 * 是否为子集
 * @param set
 * @param subset
 * @returns
 */
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) === subset;
}

function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - Math.clz32(lanes);
}

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
  // const pendingSyncLanes = lanes & SyncUpdateLanes;

  // if (pendingSyncLanes !== 0) {
  //   return pendingSyncLanes;
  // }

  switch (getHighestPriorityLane(lanes)) {
    case SyncLane:
      return SyncLane;
    case IdleLane:
      return IdleLane;
    case DefaultLane:
      return DefaultLane;
    default:
      return lanes;
  }
}
