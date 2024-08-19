import * as React from "react";

function App() {
  // const [number, setNumber] = React.useState(1);
  const numRef = React.useRef(0);
  const h1Ref = React.useRef<HTMLHeadingElement | null>(null);

  function handleClick() {
    numRef.current = numRef.current + 1;
    console.log("numRef: ", numRef.current);
    console.log("h1Ref: ", h1Ref.current);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).handleClick = handleClick;

  return <h1 ref={h1Ref}>测试啊</h1>;
}

export default App;
