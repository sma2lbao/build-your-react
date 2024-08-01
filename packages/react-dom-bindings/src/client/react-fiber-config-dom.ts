import { FiberRoot } from "react-reconciler/react-internal-types";
import { COMMENT_NODE } from "./html-node-type";

export { resolveUpdatePriority } from "./react-dom-update-priority";

export type Container = {
  _reactRootContainer?: FiberRoot;
} & (Element | Document | DocumentFragment);

export type Instance = Element;
export type TextInstance = Text;

export type Props = {
  autoFocus?: boolean;
  children: any;
  disabled?: boolean;
  hidden?: boolean;
  [key: string]: any;
};

const DOCUMENT_NODE = 9;

export const scheduleMicrotask = queueMicrotask;

export function createTextInstance(
  text: string,
  rootContainerInstance: Container
): TextInstance {
  const textNode: TextInstance = getOwnerDocumentFromRootContainer(
    rootContainerInstance
  ).createTextNode(text);
  return textNode;
}

export function createInstance(
  type: string,
  props: Props,
  rootContainerInstance: Container
) {
  const ownerDocument = getOwnerDocumentFromRootContainer(
    rootContainerInstance
  );

  let domElement: Instance;

  domElement = ownerDocument.createElement(type);

  return domElement;
}

export function shouldSetTextContent(type: string, props: Props): boolean {
  return (
    type === "textarea" ||
    type === "noscript" ||
    typeof props.children === "string" ||
    typeof props.children === "number" ||
    typeof props.children === "bigint"
  );
}

export function insertBefore(
  parentInstance: Instance,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  parentInstance.insertBefore(child, beforeChild);
}

export function appendChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.appendChild(child);
}

export function insertInContainerBefore(
  container: Container,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.insertBefore(child, beforeChild);
  } else {
    container.insertBefore(child, beforeChild);
  }
}

export function appendChildToContainer(
  container: Container,
  child: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.insertBefore(child, container);
  } else {
    container.appendChild(child);
  }
}

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  return (
    rootContainerElement.nodeType === DOCUMENT_NODE
      ? rootContainerElement
      : rootContainerElement.ownerDocument
  ) as Document;
}
