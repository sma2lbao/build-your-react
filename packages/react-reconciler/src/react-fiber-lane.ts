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
export const SyncLaneIndex = 1;

/**
 * 连续输入任务-（如：文本框输入事件）
 */
export const InputContinuousLane: Lane = 0b0000000000000000000000000001000;

/**
 * 默认任务
 */
export const DefaultLane: Lane = 0b0000000000000000000000000100000;

const TransitionLanes: Lanes = /*                       */ 0b0000000001111111111111110000000;
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000010000000;
const TransitionLane2: Lane = /*                        */ 0b0000000000000000000000100000000;
const TransitionLane3: Lane = /*                        */ 0b0000000000000000000001000000000;
const TransitionLane4: Lane = /*                        */ 0b0000000000000000000010000000000;
const TransitionLane5: Lane = /*                        */ 0b0000000000000000000100000000000;
const TransitionLane6: Lane = /*                        */ 0b0000000000000000001000000000000;
const TransitionLane7: Lane = /*                        */ 0b0000000000000000010000000000000;
const TransitionLane8: Lane = /*                        */ 0b0000000000000000100000000000000;
const TransitionLane9: Lane = /*                        */ 0b0000000000000001000000000000000;
const TransitionLane10: Lane = /*                       */ 0b0000000000000010000000000000000;
const TransitionLane11: Lane = /*                       */ 0b0000000000000100000000000000000;
const TransitionLane12: Lane = /*                       */ 0b0000000000001000000000000000000;
const TransitionLane13: Lane = /*                       */ 0b0000000000010000000000000000000;
const TransitionLane14: Lane = /*                       */ 0b0000000000100000000000000000000;
const TransitionLane15: Lane = /*                       */ 0b0000000001000000000000000000000;

const RetryLanes: Lanes = 0b0000011110000000000000000000000;
const RetryLane1: Lane = 0b0000000010000000000000000000000;
const RetryLane2: Lane = 0b0000000100000000000000000000000;
const RetryLane3: Lane = 0b0000001000000000000000000000000;
const RetryLane4: Lane = 0b0000010000000000000000000000000;

export const SomeRetryLane: Lane = RetryLane1;

/**
 * 空闲阶段任务
 */
export const IdleLane: Lane = 0b0010000000000000000000000000000;

/**
 * 离屏处理优先级管道
 */
export const OffscreenLane: Lane = 0b0100000000000000000000000000000;

/**
 * 延迟优先级
 */
export const DeferredLane: Lane = 0b1000000000000000000000000000000;

let nextTransitionLane: Lane = TransitionLane1;
let nextRetryLane: Lane = RetryLane1;

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

  if (nextLanes === NoLane) {
    // 挂起时
    return NoLanes;
  }

  if (
    wipLanes !== NoLanes &&
    wipLanes !== nextLanes &&
    (wipLanes & suspendedLanes) === NoLanes
  ) {
    const nextLane = getHighestPriorityLane(nextLanes);
    const wipLane = getHighestPriorityLane(wipLanes);

    if (
      nextLane >= wipLane ||
      (nextLane === DefaultLane && wipLane & TransitionLanes) !== NoLane
    ) {
      return wipLanes;
    }
  }

  return nextLanes;
}

export function getEntangledLanes(root: FiberRoot, renderLanes: Lanes): Lanes {
  let entangledLanes = renderLanes;

  if ((entangledLanes & InputContinuousLane) !== NoLanes) {
    // 当更新默认同步时，我们会将InputContinuousLane更新和DefaultLane更新放在一起，
    // 这样它们就会在同一个批处理中呈现。
    // 他们使用单独通道的唯一原因是持续更新应该中断转换，但默认更新不应该。
    entangledLanes |= entangledLanes & DefaultLane;
  }

  // 首先，检查是否存在纠缠的 lane，如果有的话，就把它们添加到当前的批处理中。
  // 这意味着 React 在处理更新时，会检查是否有多个任务是相互依赖的，并且需要一起被处理。
  // 一个 lane 如果与另一个 lane 纠缠在一起，那么它就不允许单独渲染，必须和被纠缠的 lane 一起在同一个批次中渲染。
  // 换句话说，纠缠的 lane 之间存在依赖关系，必须同步处理。
  // 这种情况通常出现在多个更新任务来源于同一个事件时，React 只想响应该事件的最新状态。
  // 通过纠缠这些 lane，确保它们在一起被处理，从而避免重复或过时的渲染。
  // 需要注意的是，纠缠操作是在检查是否有部分已完成的工作之后进行的。
  // 这意味着 React 先会检查当前是否有一些任务已经部分完成，然后再决定是否应用纠缠逻辑。
  // 如果一个 lane 在已经开始渲染时，因为某个交错的事件（interleaved event）而与另一个 lane 纠缠在一起，React 不会中断当前的渲染过程。
  // 即使它们在这个过程中被标记为纠缠，React 也会继续完成当前的工作。
  // 这是有意设计的，因为纠缠通常是“尽力而为”（best effort）。
  // React 会尽量在同一个批次中渲染纠缠的 lane，但如果要因此放弃已经部分完成的工作，就不太值得了。
  // 未来可能会重新考虑这一点。反对这种做法的理由是，部分完成的工作代表了一种中间状态，我们不希望这种不完整的状态展示给用户。
  // 另外，花费额外时间去完成这些中间状态，会延长展示最终状态的时间，而用户真正关心的是最终状态的展示。
  // 对于那些语义上纠缠非常重要的情况，我们应该确保在应用纠缠操作时没有未完成的部分工作。也就是说，在这些关键情况下，必须确保所有相关任务同时开始和结束。
  const allEntangledLanes = root.entangledLanes;
  if (allEntangledLanes !== NoLanes) {
  }

  return entangledLanes;
}

export function markRootFinished(
  root: FiberRoot,
  remainingLanes: Lanes,
  spawnedLane: Lane
) {
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

  if (spawnedLane !== NoLane) {
    markSpawnedDeferredLane(root, spawnedLane, NoLanes);
  }
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

/**
 * 标记更新
 * @param root
 * @param updateLane
 */
export function markRootUpdated(root: FiberRoot, updateLane: Lane) {
  root.pendingLanes |= updateLane;

  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }
}

/**
 * 标记挂起任务
 * @param root
 * @param suspendedLanes
 * @param spawnedLane
 */
export function markRootSuspended(
  root: FiberRoot,
  suspendedLanes: Lanes,
  spawnedLane: Lane
) {
  root.suspendedLanes |= suspendedLanes;
  root.pingedLanes &= ~suspendedLanes;

  if (spawnedLane !== NoLane) {
    markSpawnedDeferredLane(root, spawnedLane, suspendedLanes);
  }
}

export function markRootPinged(root: FiberRoot, pingedLanes: Lanes) {
  root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

/**
 * 标记派生的延迟类任务通道
 * @param root
 * @param spawnedLane 派生的通道
 * @param entangledLanes 相互依赖的通道
 */
function markSpawnedDeferredLane(
  root: FiberRoot,
  spawnedLane: Lane,
  entangledLanes: Lanes
) {
  root.pendingLanes |= spawnedLane;
  root.suspendedLanes &= ~spawnedLane;

  // TODO
}

export function includesSyncLane(lanes: Lanes): boolean {
  return (lanes & SyncLane) !== NoLanes;
}

export function includesNonIdleWork(lanes: Lanes): boolean {
  return (lanes & NonIdleLanes) !== NoLanes;
}

export function includesOnlyRetries(lanes: Lanes): boolean {
  return (lanes & RetryLanes) === lanes;
}

export function includesExpiredLane(root: FiberRoot, lanes: Lanes): boolean {
  return (lanes & root.expiredLanes) !== NoLanes;
}

/**
 * 是否存在阻塞通道 （即同步通道 InputContinuousLane与 DefaultLane）
 * @param root
 * @param lanes
 * @returns
 */
export function includesBlockingLane(root: FiberRoot, lanes: Lanes): boolean {
  const SyncDefaultLanes = InputContinuousLane | DefaultLane;

  return (lanes & SyncDefaultLanes) !== NoLanes;
}

export function includesOnlyNonUrgentLanes(lanes: Lanes): boolean {
  // 只用于updateDeferredValueImpl
  const UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;

  return (lanes & UrgentLanes) === NoLanes;
}

export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
  return (a & b) !== NoLanes;
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
 * set 去除 subset 优先级通道
 * @param set
 * @param subset
 * @returns
 */
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
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
    case InputContinuousLane:
      return InputContinuousLane;
    case DefaultLane:
      return DefaultLane;
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
      return lanes & TransitionLanes;
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
      return lanes & RetryLanes;
    case IdleLane:
      return IdleLane;
    case OffscreenLane:
      return OffscreenLane;
    case DeferredLane:
      // 不可能触发，因为延迟的工作总是和其他通道缠在一起调度更新。
      return NoLanes;
    default:
      return lanes;
  }
}

export function claimNextTransitionLane(): Lane {
  const lane = nextTransitionLane;
  nextTransitionLane <<= 1;
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }

  return lane;
}

/**
 * 管理 React 中的重试车道。
 * 每当需要重试某些任务时，它会返回当前的 nextRetryLane，
 * 然后将其左移一位以准备下一个重试。
 * 如果车道耗尽，重试车道会重置为初始值 RetryLane1。
 * @returns
 */
export function claimNextRetryLane(): Lane {
  const lane = nextRetryLane;
  nextRetryLane << 1;
  if ((nextRetryLane & RetryLanes) === NoLanes) {
    nextRetryLane = RetryLane1;
  }
  return lane;
}

export function laneToLanes(lane: Lane): Lanes {
  return lane;
}

export function upgradePendingLaneToSync(root: FiberRoot, lane: Lane) {
  root.pendingLanes |= SyncLane;

  root.entangledLanes |= SyncLane;
  root.entanglements[SyncLaneIndex] |= lane;
}
