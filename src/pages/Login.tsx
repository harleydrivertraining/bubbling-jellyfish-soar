"use client";

import React, { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, Lock, Shield, GraduationCap, UserCog } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/auth/SessionContextProvider";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useSession();
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  // If already logged in, go to dashboard
  useEffect(() => {
    if (!isLoading && session) {
      navigate("/", { replace: true });
    }
  }, [session, isLoading, navigate]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!cleanPhone || !password || !pin) {
      showError("Please fill in all fields.");
      return;
    }
    setIsStudentLoading(true);
    try {
      const virtualEmail = `${cleanPhone}@student.hdt.app`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: password,
      });
      if (authError) throw authError;
      if (authData.user) {
        const { data: student } = await supabase.from("students").select("user_id").eq("auth_user_id", authData.user.id).maybeSingle();
        if (!student) {
          await supabase.auth.signOut();
          throw new Error("Account not linked to a student record.");
        }
        const { data: instructor } = await supabase.from("profiles").select("instructor_pin").eq("id", student.user_id).single();
        if (instructor?.instructor_pin !== pin) {
          await supabase.auth.signOut();
          throw new Error("Incorrect Instructor PIN.");
        }
        showSuccess("Welcome back!");
      }
    } catch (error: any) {
      showError(error.message || "Login failed.");
    } finally {
      setIsStudentLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">Instructor App</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access your dashboard.</p>
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
            <div className="bg-white p-8 rounded-xl shadow-sm border hide-signup-toggle space-y-4">
              <Auth
                supabaseClient={supabase}
                providers={[]}
                appearance={{
                  theme: ThemeSupa,
                  variables: { default: { colors: { brand: "hsl(var(--primary))", brandAccent: "hsl(var(--primary-foreground))" } } },
                }}
                theme="light"
                showLinks={false}
                redirectTo={window.location.origin}
              />
              <div className="text-center pt-2">
                <Link to="/forgot-password" style={{ color: 'hsl(var(--primary))' }} className="text-sm font-bold hover:underline">
                  Forgot your password?
                </Link>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" placeholder="07123 456789" className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">Instructor PIN</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="pin" placeholder="4-digit PIN" maxLength={4} className="pl-10 font-mono tracking-widest" value={pin} onChange={(e) => setPin(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full font-bold" disabled={isStudentLoading}>
                  {isStudentLoading ? "Signing in..." : "Student Sign In"}
                </Button>
              </form>
              <div className="text-center">
                <Link to="/forgot-password" style={{ color: 'hsl(var(--primary))' }} className="text-sm font-bold hover:underline">
                  Forgot your password?
                </Link>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="https://drivinginstructorapp.uk" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
              Visit drivinginstructorapp.uk to get started
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;