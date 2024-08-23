import { TEXT_NODE } from "../client/html-node-type";
import { AnyNativeEvent } from "./plugin-module-type";

/**
 * 获取原生事件的eventTarget
 * @param nativeEvent
 * @returns
 */
function getEventTarget(nativeEvent: AnyNativeEvent) {
  const target = nativeEvent.target || nativeEvent.srcElement || window;

  return (target as any).nodeType === TEXT_NODE
    ? (target as any).parentNode
    : target;
}

export default getEventTarget;
