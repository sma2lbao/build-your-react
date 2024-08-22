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
 * Fiber 内容更新标记；一般用于宿主组件的文本更新
 */
export const ContentReset = 0b0000000000000000000000100000;

/**
 * Fiber更新标记
 */
export const Update = 0b0000000000000000000000000100;

/**
 * Fiber Ref标记
 */
export const Ref = 0b0000000000000000001000000000;

/**
 * Fiber副作用标记
 */
export const Passive = 0b0000000000000000100000000000;

export const HostEffectMask = 0b0000000000000111111111111111;

export const Incomplete = 0b0000000000001000000000000000;

export const BeforeMutationMask = Update | ChildDeletion;

export const MutationMask =
  Placement | Update | ChildDeletion | Ref | ContentReset;

export const LayoutMask = Update | Ref;

export const PassiveMask = Passive | ChildDeletion;
