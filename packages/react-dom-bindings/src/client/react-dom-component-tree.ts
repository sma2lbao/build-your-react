import { Fiber } from "react-reconciler/react-internal-types";
import {
  Container,
  Instance,
  Props,
  TextInstance,
} from "./react-fiber-config-dom";
import {
  HostComponent,
  HostRoot,
  HostText,
} from "react-reconciler/react-work-tags";

const randomKey = Math.random().toString(36).slice(2);
const internalInstanceKey = "__reactFiber$" + randomKey;
const internalPropsKey = "__reactProps$" + randomKey;
const internalContainerInstanceKey = "__reactContainer$" + randomKey;

export function detachDeletedInstance(node: Instance): void {
  delete (node as any)[internalInstanceKey];
  delete (node as any)[internalPropsKey];
}

export function getClosestInstanceFromNode(targetNode: Node): null | Fiber {
  let targetInst: Fiber | null = (targetNode as any)[internalInstanceKey];
  if (targetInst) {
    return targetInst;
  }

  let parentNode = targetNode.parentNode;
  while (parentNode) {
    targetInst =
      (parentNode as any)[internalContainerInstanceKey] ||
      (parentNode as any)[internalInstanceKey];

    if (targetInst) {
      return targetInst;
    }

    targetNode = parentNode;
    parentNode = targetNode.parentNode;
  }

  return null;
}

export function getInstanceFromNode(node: Node): Fiber | null {
  const inst =
    (node as any)[internalInstanceKey] ||
    (node as any)[internalContainerInstanceKey];

  if (inst) {
    const tag = inst.tag;
    if (tag === HostComponent || tag === HostText || tag === HostRoot) {
      return inst;
    } else {
      return null;
    }
  }

  return null;
}

export function getFiberCurrentPropsFromNode(
  node: Instance | TextInstance
): Props {
  return (node as any)[internalPropsKey] || null;
}

export function markContainerAsRoot(hostRoot: Fiber, node: Container) {
  (node as any)[internalContainerInstanceKey] = hostRoot;
}

export function unmarkContainerAsRoot(node: Container) {
  (node as any)[internalContainerInstanceKey] = null;
}

/**
 * 用 internalInstanceKey 属性对应 fiber对象
 * 可用于事件收集
 * @param hostInst
 * @param node
 */
export function precacheFiberNode(
  hostInst: Fiber,
  node: Instance | TextInstance
): void {
  (node as any)[internalInstanceKey] = hostInst;
}

export function updateFiberProps(node: Instance | TextInstance, props: Props) {
  (node as any)[internalPropsKey] = props;
}
