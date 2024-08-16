/**
 * 副作用标记
 */
export type Flags = number;

export const NoFlags = 0b0000000000000000000000000000;

/**
 * Fiber替换dom标记
 */
export const Placement = 0b0000000000000000000000000010;

/**
 * Fiber删除子元素标记
 */
export const ChildDeletion = 0b0000000000000000000000010000;

/**
 * Fiber更新标记
 */
export const Update = 0b0000000000000000000000000100;

/**
 * Fiber副作用标记
 */
export const Passive = 0b0000000000000000100000000000;

export const HostEffectMask = 0b0000000000000111111111111111;

export const Incomplete = 0b0000000000001000000000000000;

export const BeforeMutationMask = Update;

export const MutationMask = Placement | Update | ChildDeletion;

export const LayoutMask = Update;

export const PassiveMask = Passive | ChildDeletion;
