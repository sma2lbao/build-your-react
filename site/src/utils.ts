export function createTodos() {
  const todos = [];
  for (let i = 0; i < 10; i++) {
    todos.push({
      id: i + "",
      text: "Todo " + (i + 1),
      completed: Math.random() > 0.5,
    });
  }
  return todos;
}

export function filterTodos(todos: TodoItem[], tab: string) {
  return todos.filter((todo) => {
    if (tab === "all") {
      return true;
    } else if (tab === "active") {
      return !todo.completed;
    } else if (tab === "completed") {
      return todo.completed;
    }
  });
}
