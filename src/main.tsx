import React from "react";
import { createRoot } from "react-dom/client";

import { AppRouter } from "./app/router";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
