import { FiberRoot } from "react-reconciler/react-internal-types";

export type Container = {
  _reactRootContainer?: FiberRoot;
} & (Element | Document | DocumentFragment);

export type Instance = Element;
export type TextInstance = Text;

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

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  return (
    rootContainerElement.nodeType === DOCUMENT_NODE
      ? rootContainerElement
      : rootContainerElement.ownerDocument
  ) as Document;
}
