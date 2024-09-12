import { type Dispatcher } from "react-reconciler/react-internal-types";
import { BatchConfigTransition } from "react-reconciler/react-fiber-tracing-marker-component";

export type SharedStateClient = {
  H: null | Dispatcher; // for Hooks
  T: null | BatchConfigTransition;
};

const ReactSharedInternals: SharedStateClient = {
  H: null,
  T: null,
};

export default ReactSharedInternals;
