import { lazy } from "react";

const LazyHelloWorld = lazy(() => import("./lazy-hello-world.tsx"));

export default function App() {
  return (
    <div>
      <LazyHelloWorld />
    </div>
  );
}
