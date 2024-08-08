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

function resolveDispatcher() {
  const dispatcher = ReactSharedInternals.H;

  return dispatcher as Dispatcher;
}
