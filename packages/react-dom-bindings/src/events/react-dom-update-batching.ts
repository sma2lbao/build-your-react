import { batchedUpdates as batchedUpdatesImpl } from "react-reconciler/react-fiber-reconciler";

let isInsideEventHandler = false;

export function batchedUpdates(
  fn: (...args: any) => any,
  a?: unknown,
  b?: unknown
) {
  if (isInsideEventHandler) {
    return fn(a, b);
  }
  isInsideEventHandler = true;
  try {
    return batchedUpdatesImpl(fn, a);
  } finally {
    isInsideEventHandler = false;
    finishEventHandler();
  }
}

function finishEventHandler() {
  // TODO
}
