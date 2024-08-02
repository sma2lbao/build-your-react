import { Lanes, NoLanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-types";

let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber: Fiber | null = null;

export function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes
): any {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  let children = Component(props, secondArg);

  finishRenderingHooks(current, workInProgress, Component);

  return children;
}

function finishRenderingHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any
): void {
  renderLanes = NoLanes;
  currentlyRenderingFiber = null;
}
