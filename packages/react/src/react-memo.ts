import { REACT_MEMO_TYPE } from "shared/react-symbols";

export function memo<Props>(
  type: any,
  compare?: (oldProps: Props, newProps: Props) => boolean
) {
  const elementType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  };

  return elementType as any;
}
