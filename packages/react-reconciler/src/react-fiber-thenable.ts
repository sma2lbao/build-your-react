import { Thenable } from "shared/react-types";

export function isThenableResolved(thenable: Thenable<any>): boolean {
  const status = thenable.status;
  return status === "fulfilled" || status === "rejected";
}

export type ThenableState = Array<Thenable<any>>;

export const noopSuspenseyCommitThenable = {
  then() {},
};
