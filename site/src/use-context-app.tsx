/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, createContext, useContext, useMemo, useState } from "react";

interface ContextProps {
  user: any;
}

const ThemeContext = createContext<ContextProps>({ user: {} });

export default function MyApp() {
  const [theme, setTheme] = useState("light");
  const [user] = useState({ name: "someone" });
  const contextValue = useMemo<ContextProps>(() => {
    return {
      user,
    };
  }, [user]);

  const handleToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <Fragment>
        <Form />
        <label>
          <span>当前：{theme}</span>
          <button onClick={handleToggle}>切换</button>
        </label>
      </Fragment>
    </ThemeContext.Provider>
  );
}

function Form() {
  console.log("Form");
  return (
    <Panel title="Welcome">
      <Button>Sign up</Button>
    </Panel>
  );
}

function Panel({ title, children }: any) {
  console.log("Panel:");
  const { user } = useContext<ContextProps>(ThemeContext);
  return (
    <section>
      <h1>
        {title}: {user?.name}
      </h1>
      {children}
    </section>
  );
}

function Button({ children }: any) {
  const [test, setTest] = useState("test");

  const handleClick = () => {
    setTest("test" + Math.random().toString(32).slice(2));
  };

  return (
    <button onClick={handleClick}>
      {test} {children}
    </button>
  );
}
