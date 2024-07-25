import { createElement } from "react/jsx-runtime";
import * as ReactDOM from "react-dom/client";

const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(createElement("div", {}, "hello, world!"));
