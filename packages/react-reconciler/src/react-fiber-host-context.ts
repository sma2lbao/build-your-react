import { Container } from "react-fiber-config";
import { StackCursor, createCursor, pop, push } from "./react-fiber-stack";

const rootInstanceStackCursor: StackCursor<Container | null> =
  createCursor(null);

export function pushHostContainer(nextRootInstance: Container): void {
  push(rootInstanceStackCursor, nextRootInstance);
}

export function popHostContainer() {
  pop(rootInstanceStackCursor);
}

export function getRootHostContainer(): Container {
  const rootInstance = rootInstanceStackCursor.current;

  return rootInstance as Container;
}
