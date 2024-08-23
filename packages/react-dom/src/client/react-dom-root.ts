import { FiberRoot } from "react-reconciler/react-internal-types";
import { ReactNodeList } from "shared/react-types";
import { createContainer, updateContainer } from "react-reconciler";
import { ConcurrentRoot } from "react-reconciler/react-root-tags";
import { COMMENT_NODE } from "react-dom-bindings/src/client/html-node-type";
import { listenToAllSupportedEvents } from "react-dom-bindings/src/events/dom-plugin-event-system";
import {
  markContainerAsRoot,
  unmarkContainerAsRoot,
} from "react-dom-bindings/src/client/react-dom-component-tree";

export type CreateRootOptions = {
  [key: string]: any;
};

export type RootType = {
  render(children: ReactNodeList): void;
  unmount(): void;
};

export function createRoot(
  container: Element | Document,
  options?: CreateRootOptions
): RootType {
  const root = createContainer(container, ConcurrentRoot);

  markContainerAsRoot(root.current, container);

  const rootContainerElement: Document | Element | DocumentFragment =
    container.nodeType === COMMENT_NODE
      ? (container.parentNode as any)
      : container;
  listenToAllSupportedEvents(rootContainerElement);
  return new ReactDOMRoot(root);
}

class ReactDOMRoot {
  _internalRoot: FiberRoot | null;

  constructor(internalRoot: FiberRoot) {
    this._internalRoot = internalRoot;
  }

  /**
   * 渲染 react 组件
   * @param children
   */
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
      const container = root.containerInfo;
      // TODO

      unmarkContainerAsRoot(container);
    }
  }
}

export default {};
