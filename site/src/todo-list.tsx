import { useMemo } from "react";
import List from "./list";
import { filterTodos } from "./utils";

interface TodoListProps {
  todos: TodoItem[];
  theme: string;
  tab: string;
}

function TodoList(props: TodoListProps) {
  const { todos, theme, tab } = props;
  const visibleTodos = useMemo(() => filterTodos(todos, tab), [todos, tab]);

  // const visibleTodos = filterTodos(todos, tab);

  return (
    <div className={theme}>
      <List items={visibleTodos} />
    </div>
  );
}

export default TodoList;
