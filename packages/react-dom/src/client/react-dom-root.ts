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
): RootType {}

class ReactDOMRoot {
  _internalRoot: FiberRoot;

  constructor(internalRoot: FiberRoot) {
    this._internalRoot = internalRoot;
  }

  render(children: ReactNodeList): void {
    const root = this._internalRoot;
    if (root === null) {
      throw new Error("Cannot update an unmounted root.");
    }

    updateContainer(children, root, null, null);
  }
}
