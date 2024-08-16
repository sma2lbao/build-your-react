import type { EventPriority } from "react-reconciler/react-event-priorities";

export const NoEventPriority: EventPriority = 0;

const Internals = {
  p: NoEventPriority,
};

export default Internals;
