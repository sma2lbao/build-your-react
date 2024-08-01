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
      }
      break;
    }
  }
}
