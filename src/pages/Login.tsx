"use client";

import React from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from '@capacitor/core';
import { Skeleton } from "@/components/ui/skeleton";

const Login: React.FC = () => {
  // Check if we are running in a native app context (iOS/Android)
  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
            {isNative ? "Welcome to HDT Instructor" : "Instructor Sign In"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isNative 
              ? "Sign in to your account or create a new one to get started." 
              : "Please sign in to access your dashboard."}
          </p>
        </div>

        <div className={cn("bg-white p-8 rounded-xl shadow-sm border", !isNative && "hide-signup-toggle")}>
          <Auth
            supabaseClient={supabase}
            providers={[]}
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
            showLinks={true}
            redirectTo={window.location.origin}
          />
        </div>

        {!isNative && (
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default Login;