import { REACT_CONSUMER_TYPE, REACT_CONTEXT_TYPE } from "shared/react-symbols";
import { ReactContext } from "shared/react-types";

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,

    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    Provider: null as any,
    Consumer: null as any,
  };

  context.Provider = context;
  context.Consumer = {
    $$typeof: REACT_CONSUMER_TYPE,
    _context: context,
  };

  return context;
}
