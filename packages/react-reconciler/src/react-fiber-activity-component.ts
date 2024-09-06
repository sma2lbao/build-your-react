import { OffscreenMode, ReactNodeList } from "shared/react-types";
import { Fiber } from "./react-internal-types";
import { Lanes } from "./react-fiber-lane";

export type OffscreenProps = {
  mode?: OffscreenMode | null | void;
  children?: ReactNodeList;
};

export type OffscreenState = {
  baseLanes: Lanes;
  cachePool: null;
};

type OffscreenVisibility = number;

export const OffscreenVisible = 0b001;
export const OffscreenDetached = 0b010;
export const OffscreenPassiveEffectsConnected = 0b100;

export type OffscreenInstance = {
  _pendingVisibility: OffscreenVisibility;
  _visibility: OffscreenVisibility;

  _current: Fiber | null;
  detach: () => void;
  attach: () => void;
};

export function isOffscreenManual(offscreenFiber: Fiber): boolean {
  return (
    offscreenFiber.memoizedProps !== null &&
    offscreenFiber.memoizedProps.mode === "manual"
  );
}
