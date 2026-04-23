"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Mail, ArrowLeft, Loader2, CheckCircle2, GraduationCap, UserCog, AlertCircle, ShieldCheck } from "lucide-react";
import { sendPasswordResetEmail } from "@/utils/email";
import { showError } from "@/utils/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setIsSent(true);
    } catch (error: any) {
      console.error("Reset error:", error);
      showError(error.message || "Failed to send reset request.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center p-6">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <ShieldCheck className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Request Sent</CardTitle>
            <CardDescription className="text-base">
              We've notified the platform administrator that <strong>{email}</strong> needs a password reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An administrator will review your request and reset your password shortly. Please contact support if you don't hear back soon.
            </p>
            <Button asChild variant="outline" className="w-full font-bold">
              <Link to="/login">Back to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-4">
        <Button variant="ghost" asChild className="-ml-2">
          <Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Login</Link>
        </Button>
        
        <Tabs defaultValue="instructor" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="instructor" className="font-bold flex items-center gap-2">
              <UserCog className="h-4 w-4" /> Instructor
            </TabsTrigger>
            <TabsTrigger value="student" className="font-bold flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Student
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instructor" className="mt-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-black">Instructor Reset</CardTitle>
                <CardDescription>Enter your email and we'll notify the admin to reset your password.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="name@example.com" 
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full font-bold h-11" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Request...</> : "Request Password Reset"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-2xl font-black flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                  Student Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-800 leading-relaxed">
                  Students do not have real email addresses associated with their accounts. 
                </p>
                <div className="p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <p className="text-sm font-bold text-blue-900">To reset your password:</p>
                  <p className="text-sm text-blue-700 mt-1">Please contact your driving instructor directly. They can set a new password for you from your student profile page.</p>
                </div>
                <Button asChild variant="outline" className="w-full font-bold border-blue-200 text-blue-700">
                  <Link to="/login">Back to Login</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ForgotPassword;