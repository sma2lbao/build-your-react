import { OffscreenState } from "./react-fiber-activity-component";
import { isCurrentTreeHidden } from "./react-fiber-hidden-context";
import { StackCursor, createCursor, pop, push } from "./react-fiber-stack";
import { SuspenseProps, SuspenseState } from "./react-fiber-suspense-component";
import { Fiber } from "./react-internal-types";
import { OffscreenComponent } from "./react-work-tags";

export type SuspenseContext = number;

export type SubtreeSuspenseContext = number;

export type ShallowSuspenseContext = number;

const DefaultSuspenseContext = 0b00;

const SubtreeSuspenseContextMask = 0b01;

export const ForceSuspenseFallback = 0b10;

/* 表示当前树中不可见的最外层边界 */
let shellBoundary: Fiber | null = null;

/* Suspense Handler 就是挂起（suspense）组件的边界，类似于堆栈最近的catch块 */
const suspenseHandlerStackCursor: StackCursor<Fiber | null> =
  createCursor(null);

export const suspenseStackCursor: StackCursor<SuspenseContext> = createCursor(
  DefaultSuspenseContext
);

export function hasSuspenseListContext(
  parentContext: SuspenseContext,
  flag: SuspenseContext
): boolean {
  return (parentContext & flag) !== 0;
}

export function pushFallbackTreeSuspenseHandler(fiber: Fiber): void {
  // 在将渲染fallback 时。如果fallback中的某些组件暂停了，
  // 这类似于 catch 块中 throw。这个边界不应该被捕获。需要重用堆栈上的现有处理程序。
  reuseSuspenseHandlerOnStack(fiber);
}

export function reuseSuspenseHandlerOnStack(fiber: Fiber) {
  pushSuspenseListContext(fiber, suspenseStackCursor.current);
  push(suspenseHandlerStackCursor, getSuspenseHandler());
}

export function pushSuspenseListContext(
  fiber: Fiber,
  newContext: SuspenseContext
) {
  push(suspenseStackCursor, newContext);
}

export function popSuspenseListContext() {
  pop(suspenseStackCursor);
}

export function getSuspenseHandler(): Fiber | null {
  return suspenseHandlerStackCursor.current;
}

export function popSuspenseHandler(fiber: Fiber) {
  pop(suspenseHandlerStackCursor);
  if (shellBoundary === fiber) {
    shellBoundary = null;
  }
  popSuspenseListContext();
}

export function pushPrimaryTreeSuspenseHandler(handler: Fiber): void {
  const current = handler.alternate;
  const props = handler.pendingProps as SuspenseProps;

  pushSuspenseListContext(
    handler,
    setDefaultShallowSuspenseListContext(suspenseStackCursor.current)
  );

  push(suspenseHandlerStackCursor, handler);
  if (shellBoundary === null) {
    if (current === null || isCurrentTreeHidden()) {
      shellBoundary = handler;
    } else {
      const prevState = current.memoizedState as SuspenseState;
      if (prevState !== null) {
        // 当前边界在当前UI中显示fallback。
        shellBoundary = handler;
      }
    }
  }
}

export function setDefaultShallowSuspenseListContext(
  parentContext: SuspenseContext
): SuspenseContext {
  return parentContext & SubtreeSuspenseContextMask;
}

export function getShellBoundary(): Fiber | null {
  return shellBoundary;
}

export function pushOffscreenSuspenseHandler(fiber: Fiber): void {
  if (fiber.tag === OffscreenComponent) {
    pushSuspenseListContext(fiber, suspenseStackCursor.current);
    push(suspenseHandlerStackCursor, fiber);
    if (shellBoundary !== null) {
    } else {
      const current = fiber.alternate;
      if (current !== null) {
        const prevState: OffscreenState = current.memoizedState;
        if (prevState !== null) {
          shellBoundary = fiber;
        }
      }
    }
  }
}
