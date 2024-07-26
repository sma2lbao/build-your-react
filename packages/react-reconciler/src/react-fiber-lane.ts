export type Lane = number;

export type Lanes = number;

export const TotalLanes = 31;

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;

/**
 * 同步任务
 */
export const SyncLane: Lane = 0b0000000000000000000000000000010;

/**
 * 默认任务
 */
export const DefaultLane: Lane = 0b0000000000000000000000000100000;

/**
 * 空闲阶段任务
 */
export const IdleLane: Lane = 0b0010000000000000000000000000000;
