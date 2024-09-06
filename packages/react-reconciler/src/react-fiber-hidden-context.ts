import { Lanes, NoLanes, mergeLanes } from "./react-fiber-lane";
import { StackCursor, createCursor, pop, push } from "./react-fiber-stack";
import {
  getEntangledRenderLanes,
  setEntangledRenderLanes,
} from "./react-fiber-work-loop";
import { Fiber } from "./react-internal-types";

type HiddenContext = {
  baseLanes: number;
  [key: string]: any;
};

export const currentTreeHiddenStackCursor: StackCursor<HiddenContext | null> =
  createCursor(null);

export const prevEntangledRenderLanesCursor: StackCursor<Lanes> =
  createCursor(NoLanes);

export function pushHiddenContext(fiber: Fiber, context: HiddenContext): void {
  const prevEntangledRenderLanes = getEntangledRenderLanes();
  push(prevEntangledRenderLanesCursor, prevEntangledRenderLanes);
  push(currentTreeHiddenStackCursor, context);

  setEntangledRenderLanes(
    mergeLanes(prevEntangledRenderLanes, context.baseLanes)
  );
}

export function popHiddenContext(fiber: Fiber): void {
  setEntangledRenderLanes(prevEntangledRenderLanesCursor.current);

  pop(currentTreeHiddenStackCursor);
  pop(prevEntangledRenderLanesCursor);
}

export function reuseHiddenContextOnStack(fiber: Fiber): void {
  push(prevEntangledRenderLanesCursor, getEntangledRenderLanes());
  push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
}
