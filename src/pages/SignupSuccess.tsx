"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink } from "lucide-react";

const SignupSuccess: React.FC = () => {
  const handleOpenLogin = () => {
    window.open("/login", "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="border-none shadow-lg text-center p-6">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-black">Account Created!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your instructor account has been successfully registered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Please check your email to confirm your account if required. You can now sign in to access your dashboard.
            </p>
            <Button 
              onClick={handleOpenLogin} 
              className="w-full font-bold h-12 text-lg bg-primary hover:bg-primary/90"
            >
              Go to Login <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-[10px] text-muted-foreground italic">
              Clicking the button above will open the login page in a new window.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignupSuccess;