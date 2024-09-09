import { REACT_LAZY_TYPE } from "shared/react-symbols";
import { Thenable, Wakeable } from "shared/react-types";

const Uninitialized = -1;
const Pending = 0;
const Resolved = 1;
const Rejected = 2;

type UninitializedPayload<T> = {
  _status: -1;
  _result: () => Thenable<{ default: T; [key: string]: any }>;
};

type PendingPayload = {
  _status: 0;
  _result: Wakeable;
};

type ResolvedPayload<T> = {
  _status: 1;
  _result: { default: T; [key: string]: any };
};

type RejectedPayload = {
  _status: 2;
  _result: any;
};

type Payload<T> =
  | UninitializedPayload<T>
  | PendingPayload
  | ResolvedPayload<T>
  | RejectedPayload;

export type LazyComponent<T, P> = {
  $$typeof: symbol | number;
  _payload: P;
  _init: (payload: P) => T;
};

function lazyInitializer<T>(payload: Payload<T>): T {
  if (payload._status === Uninitialized) {
    const ctor = payload._result;
    const thenable = ctor();
    // 类似 Promise then 实现
    thenable.then(
      (moduleObject) => {
        if (
          (payload as Payload<T>)._status === Pending ||
          payload._status === Uninitialized
        ) {
          const resolved = payload as any;
          resolved._status = Resolved;
          resolved._result = moduleObject;
        }
      },
      (error) => {
        if (
          (payload as Payload<T>)._status === Pending ||
          payload._status === Uninitialized
        ) {
          const rejected = payload as any;
          rejected._status = Rejected;
          rejected._result = error;
        }
      }
    );

    if (payload._status === Uninitialized) {
      const pending = payload as Payload<T>;
      pending._status = Pending;
      pending._result = thenable;
    }
  }

  if (payload._status === Resolved) {
    const moduleObject = payload._result;
    return moduleObject.default;
  } else {
    throw payload._result;
  }
}

export function lazy<T>(
  ctor: () => Thenable<{ default: T; [key: string]: any }>
): LazyComponent<T, Payload<T>> {
  const payload: Payload<T> = {
    _status: Uninitialized,
    _result: ctor,
  };

  const lazyType: LazyComponent<T, Payload<T>> = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: payload,
    _init: lazyInitializer,
  };

  return lazyType;
}
