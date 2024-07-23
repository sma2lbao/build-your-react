export function createElement(type: string, config, children) {
  let propName;

  const props = {};

  let key = null;
  let ref = null;

  const childrenLength = arguments.length - 2;

  return ReactElement();
}

function ReactElement() {
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,

    type,
    key,
    ref,

    props,
  };

  return element;
}
