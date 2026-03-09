"use client";

import React from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

const Login: React.FC = () => {
  const isMobile = useIsMobile();

  // Wait for the mobile detection to initialize to avoid layout shift
  if (isMobile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 space-y-4">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
            {isMobile ? "Welcome to HDT Instructor" : "Instructor Sign In"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isMobile 
              ? "Sign in to your account or create a new one to get started." 
              : "Please sign in to access your dashboard. New registrations are handled via the mobile app."}
          </p>
        </div>

        <div className={cn("bg-white p-8 rounded-xl shadow-sm border", !isMobile && "hide-signup-toggle")}>
          <Auth
            supabaseClient={supabase}
            providers={[]} // No third-party providers
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(var(--primary))",
                    brandAccent: "hsl(var(--primary-foreground))",
                  },
                },
              },
            }}
            theme="light"
            showLinks={true} // We keep links true to allow "Forgot Password"
            redirectTo={window.location.origin}
          />
        </div>

        {/* Custom CSS to hide the sign-up link specifically on desktop while keeping forgot password */}
        {!isMobile && (
          <style>{`
            .hide-signup-toggle .supabase-auth-ui_ui-anchor:last-child {
              display: none !important;
            }
          `}</style>
        )}
      </div>
    </div>
  );
};

// Helper function since it's not imported in this file scope but used in the template
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default Login;