"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Mail, Lock, User, Loader2, ArrowRight, Info } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      showError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'instructor'
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Notify Owner of new signup - Wrapped in try/catch to prevent blocking signup
        try {
          const { data: owners } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "owner");
          
          if (owners && owners.length > 0) {
            const notifications = owners.map(owner => ({
              user_id: owner.id,
              title: "New Instructor Signup",
              message: `${firstName} ${lastName} (${email}) has just registered.`,
              type: "new_signup"
            }));
            
            await supabase.from("notifications").insert(notifications);
          }
        } catch (notifError) {
          console.warn("Admin notification failed, but signup succeeded:", notifError);
        }

        if (data.session) {
          showSuccess("Account created! Welcome aboard.");
          window.location.href = "/";
        } else {
          navigate("/signup-success");
        }
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      showError(error.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Instructor Registration
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your professional teaching account.
          </p>
        </div>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Sign Up</CardTitle>
            <CardDescription>Enter your details to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="firstName" 
                      placeholder="John" 
                      className="pl-10" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Doe" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    className="pl-10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Must be at least 6 characters.</p>
              </div>

              <Button type="submit" className="w-full font-bold h-11" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</>
                ) : (
                  <><ArrowRight className="mr-2 h-4 w-4" /> Register Account</>
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 leading-relaxed">
                <strong>Note:</strong> If you are not redirected automatically, please check your email to confirm your account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;