import { REACT_ELEMENT_TYPE } from "shared/react-symbols";

export function createElement(
  type: any,
  config: Record<string, any>,
  ...children: any
) {
  let key = null;
  let ref = null;
  const { key: _key, ref: _ref, ...rest } = config || {};
  if (_key) {
    key = "" + _key;
  }
  if (_ref) {
    ref = "" + _ref;
  }

  const props: Record<string, any> = { ...rest, children };

  // 默认参数
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return ReactElement(type, key, ref, props);
}

function ReactElement(type: any, key: string | null, ref: any, props: any) {
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
  };

  return element;
}

export function jsx(type: any, config: any, maybeKey: any) {
  let key = null;
  let ref = null;

  if (maybeKey !== undefined) {
    key = "" + maybeKey;
  }

  const { key: _key, ref: _ref, ...rest } = config || {};
  if (_key) {
    key = "" + _key;
  }
  if (_ref) {
    ref = "" + _ref;
  }

  const props: Record<string, any> = { ...rest };

  return ReactElement(type, key, ref, props);
}
