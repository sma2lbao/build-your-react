import { Lane } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-types";
import type {
  SharedQueue as ClassQueue,
  Update as ClassUpdate,
} from "./react-fiber-class-update-queue";
import { HostRoot } from "./react-work-tags";

export type ConcurrentUpdate = {
  next: ConcurrentUpdate;
  lane: Lane;
};

type ConcurrentQueue = {
  pending: ConcurrentUpdate | null;
};

export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane
): FiberRoot | null {
  //   enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);
  return getRootForUpdatedFiber(fiber);
}

function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot | null {
  let node = sourceFiber;
  let parent = node.return;

  while (parent !== null) {
    node = parent;
    parent = node.return;
  }

  return node.tag === HostRoot ? (node.stateNode as FiberRoot) : null;
}
