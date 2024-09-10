import { lazy, Suspense } from "react";
import Loading from "./loading.tsx";

const LazyHelloWorld = lazy(() => import("./lazy-hello-world.tsx"));

export default function App() {
  return (
    <div>
      <Suspense fallback={<Loading />}>
        <LazyHelloWorld />
      </Suspense>
    </div>
  );
}
