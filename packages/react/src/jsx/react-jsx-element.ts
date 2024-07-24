import { REACT_ELEMENT_TYPE } from "shared/react-symbols";

export function createElement(type: any, config: any, children: any) {
  let key = null;
  let ref = null;

  const props = {};

  const childrenLength = arguments.length - 2;

  return ReactElement(type, key, ref, props);
}

function ReactElement(type: any, key: string | null, ref: any, props: any) {
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    props,
  };

  return element;
}
