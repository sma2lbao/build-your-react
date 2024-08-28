export type ReactNode = React$Element<any> | ReactText;

export type ReactEmpty = null | void | boolean;

export type ReactFragment = ReactEmpty | Iterable<React$Node>;

export type ReactNodeList = ReactEmpty | React$Node;

export type ReactText = string | number;

export interface Wakeable {
  then(onFulfill: () => any, onReject: () => any): void | Wakeable;
}

interface ThenableImpl<T> {
  then(
    onFulfill: (value: T) => any,
    onReject: (error: any) => any
  ): void | Wakeable;
}

interface UntrackedThenable<T> extends ThenableImpl<T> {
  status?: void;
}

export interface PendingThenable<T> extends ThenableImpl<T> {
  status: "pending";
}

export interface FulfilledThenable<T> extends ThenableImpl<T> {
  status: "fulfilled";
  value: T;
}

export interface RejectedThenable<T> extends ThenableImpl<T> {
  status: "rejected";
  reason: any;
}

export type Thenable<T> =
  | UntrackedThenable<T>
  | PendingThenable<T>
  | FulfilledThenable<T>
  | RejectedThenable<T>;

export type RefObject = {
  current: any;
};

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactContext<T>;
  Consumer: ReactConsumerType<T>;
  _currentValue: T;
  _currentValue2: T;
};

export type ReactConsumerType<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T>;
};
