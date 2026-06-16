import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installDevErrorGuard } from "./dreamwalk/devErrorGuard";

installDevErrorGuard();

createRoot(document.getElementById("root")!).render(<App />);
