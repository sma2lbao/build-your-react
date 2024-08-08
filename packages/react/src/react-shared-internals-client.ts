import { type Dispatcher } from "react-reconciler/react-internal-types";

export type SharedStateClient = {
  H: null | Dispatcher; // for Hooks
};

const ReactSharedInternals: SharedStateClient = {
  H: null,
};

export default ReactSharedInternals;
