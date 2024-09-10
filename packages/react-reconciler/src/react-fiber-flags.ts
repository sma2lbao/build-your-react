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
 * 捕获错误标记 (已经处理)
 */
export const DidCapture = 0b0000000000000000000010000000;

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

/**
 * 离屏组件可见的标记
 */
export const Visibility = 0b0000000000000010000000000000;

export const StoreConsistency = 0b0000000000000100000000000000;

export const HostEffectMask = 0b0000000000000111111111111111;

/**
 * 没处理完成
 */
export const Incomplete = 0b0000000000001000000000000000;

/**
 * 应该处理 (如异步组件已解析)
 */
export const ShouldCapture = 0b0000000000010000000000000000;

export const LayoutStatic = 0b0000010000000000000000000000;

export const PassiveStatic = 0b0000100000000000000000000000;

export const RefStatic = 0b0000001000000000000000000000;

// 可以重用这些 bit 位，因为这些标志对于不同的fiber类型是互斥的。bit 数量问题。
export const ScheduleRetry = StoreConsistency;
export const DidDefer = ContentReset;

export const BeforeMutationMask = Update | ChildDeletion;

export const MutationMask =
  Placement | Update | ChildDeletion | Ref | ContentReset;

export const LayoutMask = Update | Ref;

export const PassiveMask = Passive | ChildDeletion;

// 不被克隆重置的标签的联合。
// 这允许某些概念持续存在而无需重新计算它们，例如子树是否包含被动效果或门户。
export const StaticMask = LayoutStatic | PassiveStatic | RefStatic;
