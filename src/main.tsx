import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import "./styles/calendar.css"; // Import the new calendar specific styles

createRoot(document.getElementById("root")!).render(<App />);