export function setValueForKnownAttribute(
  node: Element,
  name: string,
  value: any
) {
  if (value === null) {
    node.removeAttribute(name);
    return;
  }
  switch (typeof value) {
    case "undefined":
    case "function":
    case "symbol":
    case "boolean": {
      node.removeAttribute(name);
      return;
    }
  }

  node.setAttribute(name, "" + value);
}
