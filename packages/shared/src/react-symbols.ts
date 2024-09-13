export const REACT_PORTAL_TYPE = Symbol.for("react.portal");

export const REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");

export const REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");

export const REACT_MEMO_TYPE = Symbol.for("react.memo");

export const REACT_CONTEXT_TYPE = Symbol.for("react.context");
// export const REACT_PROVIDER_TYPE = Symbol.for("react.provider");
export const REACT_CONSUMER_TYPE = Symbol.for("react.consumer");

export const REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");

export const REACT_LAZY_TYPE = Symbol.for("react.lazy");

export const REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");

export const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");

const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = "@@iterator";

export function getIteratorFn(maybeIterable?: any) {
  if (maybeIterable === null || typeof maybeIterable !== "object") {
    return null;
  }

  const maybeIterator =
    (MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL]) ||
    maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === "function") {
    return maybeIterator;
  }

  return null;
}
