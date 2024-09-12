import { Fiber } from "./react-internal-types";

export type BatchConfigTransition = {
  name?: string;
  startTime?: number;
  _updateFibers?: Set<Fiber>;
};
