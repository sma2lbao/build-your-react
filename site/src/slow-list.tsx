import * as React from "react";

const SlowItem = (props: any) => {
  const startTime = performance.now();
  while (performance.now() - startTime < 150) {
    // 暂停
  }

  return <li className="item">{props.text}</li>;
};

const SlowList = () => {
  const [text, updateText] = React.useState("text");
  const deferredText = React.useDeferredValue(text);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).updateText = updateText;

  return (
    <ul>
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
      <SlowItem text={deferredText} />
    </ul>
  );
};

export default SlowList;
