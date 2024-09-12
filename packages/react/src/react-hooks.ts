import { Dispatcher } from "react-reconciler/react-internal-types";
import ReactSharedInternals from "./react-shared-internals-client";
import { ReactContext, StartTransitionOptions } from "shared/react-types";

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

export function useRef<T>(initialValue: T): { current: T } {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, deps);
}

export function useMemo<T>(create: () => T, deps: Array<any> | void | null): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, deps);
}

export function useCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, deps);
}

export function useId(): string {
  const dispatcher = resolveDispatcher();
  return dispatcher.useId();
}

export function useReducer<S, I, A>(
  reducer: (s: S, a: A) => S,
  initialArg: I,
  init?: (i: I) => S
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

export function useContext<T>(Context: ReactContext<T>): T {
  const dispatcher = resolveDispatcher();

  return dispatcher.useContext(Context);
}

export function useTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}

function resolveDispatcher() {
  const dispatcher = ReactSharedInternals.H;

  return dispatcher as Dispatcher;
}
