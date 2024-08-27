import sanitizeURL from "../shared/sanitize-url";
import { setValueForStyles } from "./css-property-operations";
import { setValueForKnownAttribute } from "./dom-property-operations";
import { setTextContent } from "./set-text-content";

export function setInitialProperties(
  domElement: Element,
  tag: string,
  props: any
): void {
  for (const propKey in props) {
    const propValue = props[propKey];
    if (propValue == null) {
      continue;
    }
    setProp(domElement, tag, propKey, propValue, props, null);
  }
}

/**
 * 给原生DOM添加属性
 * @param domElement
 * @param tag
 * @param key
 * @param value
 * @param props
 * @param prevValue
 */
function setProp(
  domElement: Element,
  tag: string,
  key: string,
  value: any,
  props: any,
  prevValue: any
): void {
  switch (key) {
    case "children": {
      if (typeof value === "string") {
        const canSetTextContent =
          tag !== "body" && (tag !== "textarea" || value !== "");
        if (canSetTextContent) {
          setTextContent(domElement, value);
        }
      } else if (typeof value === "number" || typeof value === "bigint") {
        const canSetTextContent = tag !== "body";
        if (canSetTextContent) {
          setTextContent(domElement, "" + value);
        }
      }
      break;
    }
    case "className":
      setValueForKnownAttribute(domElement, "class", value);
      break;
    case "style": {
      setValueForStyles(domElement as HTMLElement, value, prevValue);
      break;
    }
    case "width":
    case "height": {
      setValueForKnownAttribute(domElement, key, value);
      break;
    }
    case "src":
    case "href": {
      if (
        value == null ||
        typeof value === "function" ||
        typeof value === "symbol" ||
        typeof value === "boolean"
      ) {
        domElement.removeAttribute(key);
        break;
      }

      const sanitizedValue = sanitizeURL("" + value);
      domElement.setAttribute(key, sanitizedValue);
      break;
    }
  }
}

export function updateProperties(
  domElement: Element,
  tag: string,
  lastProps: Record<string, any>,
  nextProps: Record<string, any>
): void {
  for (const propKey in lastProps) {
    const lastProp = lastProps[propKey];
    if (
      lastProps.hasOwnProperty(propKey) &&
      lastProp != null &&
      !nextProps.hasOwnProperty(propKey)
    ) {
      setProp(domElement, tag, propKey, null, nextProps, lastProp);
    }
  }
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey];
    const lastProp = lastProps[propKey];
    if (
      nextProps.hasOwnProperty(propKey) &&
      nextProp !== lastProp &&
      (nextProp != null || lastProp != null)
    ) {
      setProp(domElement, tag, propKey, nextProp, nextProps, lastProp);
    }
  }
}
