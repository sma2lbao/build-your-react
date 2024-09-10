import { ReactNodeList, Wakeable } from "shared/react-types";
import { Lane } from "./react-fiber-lane";

export type SuspenseProps = {
  children?: ReactNodeList;
  fallback?: ReactNodeList;
};

export type SuspenseState = {
  // treeContext: TreeContext,

  retryLane: Lane;
};

export type RetryQueue = Set<Wakeable>;
