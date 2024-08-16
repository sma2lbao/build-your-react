import * as React from "react";

function App() {
  const [number, setNumber] = React.useState(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).updateNumber = setNumber;

  React.useEffect(() => {
    console.log("执行了 create", number);
    return () => {
      console.log("执行了 destory", number);
    };
  }, []);

  return <h1>{number}</h1>;
}

export default App;
