import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import "./styles/calendar.css";
import { initBilling } from "./utils/billing";

// Initialize Google Billing for Android
initBilling();

createRoot(document.getElementById("root")!).render(<App />);