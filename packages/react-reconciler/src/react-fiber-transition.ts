import ReactSharedInternals from "shared/react-shared-internals";
import type { BatchConfigTransition } from "./react-fiber-tracing-marker-component";

export function requestCurrentTransition(): BatchConfigTransition | null {
  return ReactSharedInternals.T;
}
