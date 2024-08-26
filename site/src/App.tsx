import { useState } from "react";
import { createTodos } from "./utils.ts";
import TodoList from "./todo-list.tsx";

const todos = createTodos();

export default function App() {
  const [tab, setTab] = useState("all");
  const [isDark, setIsDark] = useState(false);

  const handleThemeChange = () => {
    setIsDark(!isDark);
  };

  return (
    <div>
      <button onClick={() => setTab("all")}>All</button>
      <button onClick={() => setTab("active")}>Active</button>
      <button onClick={() => setTab("completed")}>Completed</button>
      <br />
      <button onClick={handleThemeChange}>改变主题</button>
      <hr />
      <TodoList todos={todos} tab={tab} theme={isDark ? "dark" : "light"} />
    </div>
  );
}
