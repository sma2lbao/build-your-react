import isUnitlessNumber from "../shared/is-unitless-number";

export function setValueForStyles(
  node: HTMLElement,
  styles: Record<string, number | string | boolean>,
  prevStyles?: null | Record<string, number | string | boolean>
) {
  if (styles != null && typeof styles !== "object") {
    throw new Error(
      "The `style` prop expects a mapping from style properties to values, " +
        "not a string. For example, style={{marginRight: spacing + 'em'}} when " +
        "using JSX."
    );
  }

  const style = node.style;

  if (prevStyles != null) {
    for (const styleName in prevStyles) {
      if (
        prevStyles.hasOwnProperty(styleName) &&
        (styles == null || !styles.hasOwnProperty(styleName))
      ) {
        // 清除样式
        const isCustomProperty = styleName.indexOf("--") === 0;
        if (isCustomProperty) {
          style.setProperty(styleName, "");
        } else if (styleName === "float") {
          style.cssFloat = "";
        } else {
          (style as any)[styleName] = "";
        }
      }
    }

    for (const styleName in styles) {
      const value = styles[styleName];
      if (styles.hasOwnProperty(styleName) && prevStyles[styleName] !== value) {
        setValueForStyle(style, styleName, value);
      }
    }
  } else {
    for (const styleName in styles) {
      if (styles.hasOwnProperty(styleName)) {
        const value = styles[styleName];
        setValueForStyle(style, styleName, value);
      }
    }
  }
}

function setValueForStyle(
  style: CSSStyleDeclaration,
  styleName: string,
  value?: number | boolean | string | null
) {
  const isCustomProperty = styleName.indexOf("--") === 0;

  if (value == null || typeof value === "boolean" || value === "") {
  } else if (isCustomProperty) {
    style.setProperty(styleName, value as string);
  } else if (
    typeof value === "number" &&
    value !== 0 &&
    !isUnitlessNumber(styleName)
  ) {
    (style as any)[styleName] = value + "px";
  } else {
    if (styleName === "float") {
      style.cssFloat = value as string;
    } else {
      (style as any)[styleName] = ("" + value).trim();
    }
  }
}
