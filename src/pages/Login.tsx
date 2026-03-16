"use client";

import React, { useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from '@capacitor/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, Lock, Shield, GraduationCap, UserCog } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

const Login: React.FC = () => {
  const isNative = Capacitor.isNativePlatform();
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  
  // Student Login State
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password || !pin) {
      showError("Please fill in all fields.");
      return;
    }

    setIsStudentLoading(true);
    try {
      // 1. Find the instructor by PIN
      const { data: instructor, error: pinError } = await supabase
        .from("profiles")
        .select("id")
        .eq("instructor_pin", pin)
        .single();

      if (pinError || !instructor) {
        throw new Error("Invalid Instructor PIN.");
      }

      // 2. Attempt login using the virtual email
      const virtualEmail = `${phone.replace(/\s+/g, '')}@student.hdt.app`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: password,
      });

      if (authError) throw authError;

      // 3. Verify this student belongs to this instructor
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("auth_user_id", authData.user.id)
        .eq("user_id", instructor.id)
        .single();

      if (studentError || !student) {
        await supabase.auth.signOut();
        throw new Error("This account is not linked to this instructor.");
      }

      showSuccess("Welcome back!");
    } catch (error: any) {
      console.error("Login error:", error);
      showError(error.message || "Login failed. Please check your credentials.");
    } finally {
      setIsStudentLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
            HDT Instructor App
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your dashboard.
          </p>
        </div>

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
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="phone" 
                      placeholder="07123 456789" 
                      className="pl-10" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pin">Instructor PIN</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="pin" 
                      placeholder="4-digit PIN" 
                      maxLength={4} 
                      className="pl-10 font-mono tracking-widest" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ask your instructor for their unique 4-digit PIN.</p>
                </div>

                <Button type="submit" className="w-full font-bold" disabled={isStudentLoading}>
                  {isStudentLoading ? "Signing in..." : "Student Sign In"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>

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