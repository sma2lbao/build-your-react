import { FiberRoot } from "react-reconciler/react-internal-types";
import { ReactNodeList } from "shared/react-types";
import { createContainer, updateContainer } from "react-reconciler";

export type CreateRootOptions = {
  [key: string]: any;
};

export type RootType = {
  render(childrent: ReactNodeList): void;
  unmount(): void;
};

export function createRoot(
  container: Element | Document,
  options?: CreateRootOptions
): RootType {
  const root = createContainer(container, 1);

  return new ReactDOMRoot(root);
}

class ReactDOMRoot {
  _internalRoot: FiberRoot | null;

  constructor(internalRoot: FiberRoot) {
    this._internalRoot = internalRoot;
  }

  render(children: ReactNodeList): void {
    const root = this._internalRoot;
    if (root === null) {
      throw new Error("Cannot update an unmounted root.");
    }

    updateContainer(children, root, null);
  }

  unmount(): void {
    const root = this._internalRoot;

    if (root !== null) {
      this._internalRoot = null;
      // TODO
    }
  }
}
