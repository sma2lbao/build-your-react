import { Dispatcher } from "react-reconciler/react-internal-types";
import ReactSharedInternals from "./react-shared-internals-client";

type Dispatch<A> = (action: A) => void;
type BasicStateAction<S> = S | ((state: S) => S);

export function useState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();

  return dispatcher.useState(initialState);
}

export function useDeferredValue<T>(value: T, initialState?: T): T {
  const dispatcher = resolveDispatcher();

  return dispatcher.useDeferredValue(value, initialState);
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

function resolveDispatcher() {
  const dispatcher = ReactSharedInternals.H;

  return dispatcher as Dispatcher;
}
