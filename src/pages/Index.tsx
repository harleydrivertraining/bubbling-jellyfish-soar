// This file is no longer needed as Dashboard is the default route.
// It can be removed or kept as a redirect if necessary.
// For now, I'll leave it as a simple redirect or blank.
// The actual content is now in Dashboard.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/dashboard"); // Redirect to the new Dashboard
  }, [navigate]);

  return null; // Or a loading spinner
};

export default Index;