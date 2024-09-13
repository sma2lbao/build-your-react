import { useRef } from "react";
import MyInput from "./my-input";

export default function Form() {
  const ref = useRef(null);

  function handleClick() {
    ref.current.focus();
    console.log(ref.current);
    // 下方代码不起作用，因为 DOM 节点并未被暴露出来：
    // ref.current.style.opacity = 0.5;
  }

  return (
    <div>
      <MyInput placeholder="Enter your name" ref={ref} />
      <span type="button" onClick={handleClick}>
        Edit
      </span>
    </div>
  );
}
