import { REACT_FORWARD_REF_TYPE } from "shared/react-symbols";

export function forwardRef<Props, ElementType>(
  render: (props: Props, ref: any) => any
) {
  const elementType = {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render,
  };

  return elementType;
}
