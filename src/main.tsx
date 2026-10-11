import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Missing React mount element: "#root"');
}

createRoot(rootElement).render(
  <App
    now={() => new Date()}
    initialHash={window.location.hash}
    onHashChange={(hash) => {
      window.location.hash = hash;
    }}
  />,
);
