/**
 * 副作用标记
 */
export type Flags = number;

export const NoFlags = 0b0000000000000000000000000000;

export const Placement = 0b0000000000000000000000000010;

export const ChildDeletion = 0b0000000000000000000000010000;

export const Update = 0b0000000000000000000000000100;

export const HostEffectMask = 0b0000000000000111111111111111;

export const Incomplete = 0b0000000000001000000000000000;

export const MutationMask = Placement | Update | ChildDeletion;

export const BeforeMutationMask = Update;

export const LayoutMask = Update;
