import { FiberRoot } from "react-reconciler/react-internal-types";

export type Container = {
  _reactRootContainer?: FiberRoot;
} & (Element | Document | DocumentFragment);
