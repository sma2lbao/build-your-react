import * as React from "react";

function App() {
  const [number, setNumber] = React.useState(1);
  const deferredValue = React.useDeferredValue(number);
  console.log("number: ", number, deferredValue);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).updateNumber = setNumber;

  return <h1>{number}</h1>;
}

export default App;
