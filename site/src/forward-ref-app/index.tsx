import { useRef } from "react";
import MyInput from "./my-input";

export default function Form() {
  const ref = useRef(null);

  function handleClick() {
    ref.current.focus();
  }

  return (
    <form>
      <MyInput label="Enter your name:" ref={ref} />
      <span onClick={handleClick}>Edit</span>
    </form>
  );
}
