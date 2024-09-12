import ReactSharedInternals from "./react-shared-internals-client";
import type { BatchConfigTransition } from "react-reconciler/react-fiber-tracing-marker-component";
import type { StartTransitionOptions } from "shared/react-types";

export function startTransition(
  scope: () => void,
  options?: StartTransitionOptions
) {
  const prevTransition = ReactSharedInternals.T;
  const transition: BatchConfigTransition = {};
  ReactSharedInternals.T = transition;

  try {
    scope();
  } finally {
    ReactSharedInternals.T = prevTransition;
  }
}
