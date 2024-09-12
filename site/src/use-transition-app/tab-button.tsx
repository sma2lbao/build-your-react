import * as React from "react";
import "./index.css";

export default function TabButton({ children, isActive, onClick }) {
  const [isPending, startTransition] = React.useTransition();
  if (isActive) {
    return <b>{children}</b>;
  }
  if (isPending) {
    return <b className="pending">{children}</b>;
  }
  return (
    <button
      onClick={() => {
        startTransition(() => {
          onClick();
        });
      }}
    >
      {children}
    </button>
  );
}
