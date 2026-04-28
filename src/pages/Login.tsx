"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Lock, Shield, GraduationCap, UserCog, Info, UserPlus, Mail, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/auth/SessionContextProvider";
import { Capacitor } from "@capacitor/core";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useSession();
  
  // Instructor State
  const [isInstructorLoading, setIsInstructorLoading] = useState(false);
  const [instructorEmail, setInstructorEmail] = useState("");
  const [instructorPassword, setInstructorPassword] = useState("");
  const [rememberInstructor, setRememberInstructor] = useState(false);

  // Student State
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  const [studentPhone, setStudentPhone] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentPin, setStudentPin] = useState("");
  const [rememberStudent, setRememberStudent] = useState(false);

  // Load remembered credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("hdt_remembered_instructor_email");
    if (savedEmail) {
      setInstructorEmail(savedEmail);
      setRememberInstructor(true);
    }

    const savedPhone = localStorage.getItem("hdt_remembered_student_phone");
    const savedPin = localStorage.getItem("hdt_remembered_student_pin");
    if (savedPhone) {
      setStudentPhone(savedPhone);
      setStudentPin(savedPin || "");
      setRememberStudent(true);
    }
  }, []);

  // If already logged in, go to dashboard
  useEffect(() => {
    if (!isLoading && session) {
      navigate("/", { replace: true });
    }
  }, [session, isLoading, navigate]);

  const handleInstructorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorEmail || !instructorPassword) {
      showError("Please enter your email and password.");
      return;
    }

    setIsInstructorLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: instructorEmail,
        password: instructorPassword,
      });

      if (error) throw error;

      // Handle "Remember Me"
      if (rememberInstructor) {
        localStorage.setItem("hdt_remembered_instructor_email", instructorEmail);
      } else {
        localStorage.removeItem("hdt_remembered_instructor_email");
      }

      showSuccess("Welcome back!");
    } catch (error: any) {
      showError(error.message || "Login failed.");
    } finally {
      setIsInstructorLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = studentPhone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!cleanPhone || !studentPassword || !studentPin) {
      showError("Please fill in all fields.");
      return;
    }

    setIsStudentLoading(true);
    try {
      const virtualEmail = `${cleanPhone}@student.hdt.app`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: studentPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: student } = await supabase
          .from("students")
          .select("user_id")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();

        if (!student) {
          await supabase.auth.signOut();
          throw new Error("Account not linked to a student record.");
        }

        const { data: instructor } = await supabase
          .from("profiles")
          .select("instructor_pin")
          .eq("id", student.user_id)
          .single();

        if (instructor?.instructor_pin !== studentPin) {
          await supabase.auth.signOut();
          throw new Error("Incorrect Instructor PIN.");
        }

        // Handle "Remember Me"
        if (rememberStudent) {
          localStorage.setItem("hdt_remembered_student_phone", studentPhone);
          localStorage.setItem("hdt_remembered_student_pin", studentPin);
        } else {
          localStorage.removeItem("hdt_remembered_student_phone");
          localStorage.removeItem("hdt_remembered_student_pin");
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

  const isNative = Capacitor.isNativePlatform();

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
            <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
              <form onSubmit={handleInstructorLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inst-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="inst-email" 
                      type="email"
                      placeholder="name@example.com" 
                      className="pl-10" 
                      value={instructorEmail} 
                      onChange={(e) => setInstructorEmail(e.target.value)} 
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inst-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="inst-password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10" 
                      value={instructorPassword} 
                      onChange={(e) => setInstructorPassword(e.target.value)} 
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox 
                    id="remember-inst" 
                    checked={rememberInstructor} 
                    onCheckedChange={(checked) => setRememberInstructor(!!checked)} 
                  />
                  <label
                    htmlFor="remember-inst"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remember my email
                  </label>
                </div>

                <Button type="submit" className="w-full font-bold h-11" disabled={isInstructorLoading}>
                  {isInstructorLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Instructor Sign In"}
                </Button>
              </form>
              
              <div className="text-center pt-4 flex flex-col gap-4 border-t">
                <Link to="/forgot-password" style={{ color: 'hsl(var(--primary))' }} className="text-sm font-bold hover:underline">
                  Forgot your password?
                </Link>

                {isNative ? (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3 text-left">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      New instructors: Please visit <span className="font-bold">drivinginstructorapp.uk</span> on your web browser to set up your account.
                    </p>
                  </div>
                ) : (
                  <Button asChild variant="outline" className="w-full font-bold h-11 border-primary/20 text-primary hover:bg-primary/5">
                    <Link to="/74985">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Don't have an account? Sign up
                    </Link>
                  </Button>
                )}
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
                    <Input id="phone" placeholder="07123 456789" className="pl-10" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={studentPassword} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">Instructor PIN</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="pin" placeholder="4-digit PIN" maxLength={4} className="pl-10 font-mono tracking-widest" value={studentPin} onChange={(e) => setStudentPin(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox 
                    id="remember-student" 
                    checked={rememberStudent} 
                    onCheckedChange={(checked) => setRememberStudent(!!checked)} 
                  />
                  <label
                    htmlFor="remember-student"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Remember my details
                  </label>
                </div>

                <Button type="submit" className="w-full font-bold h-11" disabled={isStudentLoading}>
                  {isStudentLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Student Sign In"}
                </Button>
              </form>
              <div className="text-center pt-4 border-t">
                <Link to="/forgot-password" style={{ color: 'hsl(var(--primary))' }} className="text-sm font-bold hover:underline">
                  Forgot your password?
                </Link>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Login;