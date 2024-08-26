import { memo } from "react";

interface ListProps {
  items: TodoItem[];
}

function List(props: ListProps) {
  const { items } = props;
  console.log(
    "[ARTIFICIALLY SLOW] Rendering <List /> with " + items.length + " items"
  );
  const startTime = performance.now();
  while (performance.now() - startTime < 500) {
    // 在 500 毫秒内不执行任何操作以模拟极慢的代码
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.completed ? <s>{item.text}</s> : item.text}</li>
      ))}
    </ul>
  );
}

export default memo(List);
