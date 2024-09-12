import { createRoot } from "react-dom/client";
// import SlowList from "./slow-list";
// import App from "./App";
// import BoxComparison from "./box-comparison";
// import App from "./use-reducer-app";
// import App from "./use-context-app";
// import App from "./activity-app";
// import App from "./use-transition-app";
import App from "./use-sync-external-store";

createRoot(document.getElementById("root")!).render(<App />);
