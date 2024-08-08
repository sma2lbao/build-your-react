import * as React from "react";

function App() {
  const [number, setNumber] = React.useState(1);

  console.log("number: ", number);

  return <h1>Vite + React</h1>;
}

export default App;
