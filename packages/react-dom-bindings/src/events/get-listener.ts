import { Fiber } from "react-reconciler/react-internal-types";
import { getFiberCurrentPropsFromNode } from "../client/react-dom-component-tree";
import { Props } from "../client/react-fiber-config-dom";

/**
 * 通过 dom 对象的 props对象获取 组件注册的监听器
 * @param inst 原生组件 Fiber 对象
 * @param registrationName 事件名 eg. onClick
 * @returns
 */
export default function getListener(
  inst: Fiber,
  registrationName: string
): Function | null {
  const stateNode = inst.stateNode;

  if (stateNode === null) {
    return null;
  }

  const props = getFiberCurrentPropsFromNode(stateNode);
  if (props === null) {
    return null;
  }

  const listener = props[registrationName];

  if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
    return null;
  }

  if (listener && typeof listener !== "function") {
    throw new Error(
      `Expected \`${registrationName}\` listener to be a function, instead got a value of \`${typeof listener}\` type.`
    );
  }

  return listener;
}

function shouldPreventMouseEvent(
  name: string,
  type: string,
  props: Props
): boolean {
  switch (name) {
    case "onClick":
      return !!(props.disabled && isInteractive(type));
    default:
      return false;
  }
}

function isInteractive(tag: string): boolean {
  return (
    tag === "button" ||
    tag === "input" ||
    tag === "select" ||
    tag === "textarea"
  );
}
