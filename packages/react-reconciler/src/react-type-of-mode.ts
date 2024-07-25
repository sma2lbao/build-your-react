export type TypeOfMode = number;

export const NoMode = /*                         */ 0b0000000;
// TODO: Remove ConcurrentMode by reading from the root tag instead
export const ConcurrentMode = /*                 */ 0b0000001;
export const ProfileMode = /*                    */ 0b0000010;
export const DebugTracingMode = /*               */ 0b0000100;
export const StrictLegacyMode = /*               */ 0b0001000;
export const StrictEffectsMode = /*              */ 0b0010000;
export const ConcurrentUpdatesByDefaultMode = /* */ 0b0100000;
export const NoStrictPassiveEffectsMode = /*     */ 0b1000000;
