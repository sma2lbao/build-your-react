import {
  DefaultLane,
  IdleLane,
  InputContinuousLane,
  Lane,
  Lanes,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  includesNonIdleWork,
} from "./react-fiber-lane";

export type EventPriority = Lane;

export const NoEventPriority: EventPriority = NoLane;
export const DiscreteEventPriority: EventPriority = SyncLane;
export const ContinuousEventPriority: EventPriority = InputContinuousLane;
export const DefaultEventPriority: EventPriority = DefaultLane;
export const IdleEventPriority: EventPriority = IdleLane;

export function lanesToEventPriority(lanes: Lanes): EventPriority {
  const lane = getHighestPriorityLane(lanes);

  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority;
  }

  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority;
  }

  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority;
  }

  return IdleEventPriority;
}

export function eventPriorityToLane(updatePriority: EventPriority): Lane {
  return updatePriority;
}

export function isHigherEventPriority(
  a: EventPriority,
  b: EventPriority
): boolean {
  return a !== 0 && a < b;
}
