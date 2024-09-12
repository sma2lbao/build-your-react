import { FiberRoot } from "react-reconciler/react-internal-types";
import { COMMENT_NODE } from "./html-node-type";
import { setInitialProperties, updateProperties } from "./react-dom-component";
import { setTextContent } from "./set-text-content";
import {
  precacheFiberNode,
  updateFiberProps,
} from "./react-dom-component-tree";

export {
  resolveUpdatePriority,
  setCurrentUpdatePriority,
  getCurrentUpdatePriority,
} from "./react-dom-update-priority";

export { detachDeletedInstance } from "./react-dom-component-tree";

export type Container = {
  _reactRootContainer?: FiberRoot;
} & (Element | Document | DocumentFragment);

export type Instance = Element;
export type TextInstance = Text;
export type Type = string;
export type Props = {
  autoFocus?: boolean;
  children: any;
  disabled?: boolean;
  hidden?: boolean;
  [key: string]: any;
};

const DOCUMENT_NODE = 9;

/**
 * 首次渲染支持
 */
export const supportsMutation = true;

export const scheduleMicrotask = queueMicrotask;

/**
 * useContext 中有用到
 */
export const isPrimaryRenderer = true;

let currentPopstateTransitionEvent: Event | null = null;

/**
 * 创建文本节点
 * @param text
 * @param rootContainerInstance
 * @returns
 */
export function createTextInstance(
  text: string,
  rootContainerInstance: Container,
  internalInstanceHandle: Object
): TextInstance {
  const textNode: TextInstance = getOwnerDocumentFromRootContainer(
    rootContainerInstance
  ).createTextNode(text);

  precacheFiberNode(internalInstanceHandle as any, textNode);

  return textNode;
}

export function createInstance(
  type: string,
  props: Props,
  rootContainerInstance: Container,
  internalInstanceHandle: Object
) {
  const ownerDocument = getOwnerDocumentFromRootContainer(
    rootContainerInstance
  );

  let domElement: Instance;

  domElement = ownerDocument.createElement(type);
  precacheFiberNode(internalInstanceHandle as any, domElement);
  updateFiberProps(domElement, props);
  return domElement;
}

export function appendInitialChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.appendChild(child);
}

export function finalizeInitialChildren(
  domElement: Instance,
  type: string,
  props: Props
): boolean {
  setInitialProperties(domElement, type, props);
  switch (type) {
    case "button":
    case "input":
    case "select":
    case "textarea":
      return !!props.autoFocus;
    case "img":
      return true;
    default:
      return false;
  }
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

export function commitUpdate(
  domElement: Instance,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object
): void {
  updateProperties(domElement, type, oldProps, newProps);
  updateFiberProps(domElement, newProps);
}

export function resetTextContent(domElement: Instance): void {
  setTextContent(domElement, "");
}

export function commitTextUpdate(
  textInstance: TextInstance,
  oldText: string,
  newText: string
): void {
  textInstance.nodeValue = newText;
}

export function getPublicInstance(instance: Instance) {
  return instance;
}

export function removeChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.removeChild(child);
}

export function removeChildFromContainer(
  container: Container,
  child: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.removeChild(child);
  } else {
    container.removeChild(child);
  }
}

export function hideInstance(instance: Instance): void {
  const style = (instance as HTMLElement).style;
  if (typeof style.setProperty === "function") {
    style.setProperty("display", "none", "important");
  } else {
    style.display = "none";
  }
}

export function unhideInstance(instance: Instance, props: Props): void {
  const styleProp = props["style"];
  const display =
    styleProp !== undefined &&
    styleProp !== null &&
    styleProp.hasOwnProperty("display")
      ? styleProp.display
      : null;
  (instance as HTMLElement).style.display =
    display === null || typeof display === "boolean"
      ? ""
      : ("" + display).trim();
}

export function shouldAttemptEagerTransition(): boolean {
  const event = window.event;
  if (event && event.type === "popstate") {
    if (event === currentPopstateTransitionEvent) {
      return false;
    } else {
      currentPopstateTransitionEvent = event;
      return true;
    }
  }
  // 没在 popstate 中
  currentPopstateTransitionEvent = null;
  return false;
}
