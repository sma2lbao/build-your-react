import { REACT_ELEMENT_TYPE } from "shared/react-symbols";

export function createElement(
  type: any,
  config: Record<string, any>,
  ...children: any
) {
  let key = config?.key !== undefined ? "" + config.key : null;
  let ref = null;
  const { ...rest } = config || {};

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

function ReactElement(type: any, key: string | null, _ref: any, props: any) {
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref: props?.ref ?? null,
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

  if (config?.key !== undefined) {
    key = "" + config.key;
  }

  const props: Record<string, any> = config || {};

  return ReactElement(type, key, ref, props);
}
