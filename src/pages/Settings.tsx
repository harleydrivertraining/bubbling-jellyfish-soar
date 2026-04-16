"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutList, UserCog, ShieldCheck, Bell, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import NotificationSettingsForm from "@/components/NotificationSettingsForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import ChangeEmailForm from "@/components/ChangeEmailForm";
import MenuCustomizer from "@/components/MenuCustomizer";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SettingsTab = "profile" | "notifications" | "menu" | "account";

const Settings: React.FC = () => {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      const role = data?.role?.toLowerCase() || 'instructor';
      setUserRole(role);
      
      // If student, force the account tab
      if (role === 'student') {
        setActiveTab("account");
      }
      setIsLoading(false);
    };
    fetchRole();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isStudent = userRole === 'student';

  const navItems = [
    { id: "profile", label: "Profile", icon: UserCog },
    { id: "notifications", label: "Alerts", icon: Bell },
    { id: "menu", label: "Menu", icon: LayoutList },
    { id: "account", label: "Security", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-medium text-sm">
          {isStudent ? "Manage your security and account access." : "Manage your account and app preferences."}
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Top Navigation Tabs - Scrollable on mobile */}
        {!isStudent && (
          <div className="px-1">
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border w-full overflow-x-auto no-scrollbar scroll-smooth">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "flex-1 min-w-[90px] sm:min-w-[120px] font-bold h-10 rounded-lg transition-all text-xs sm:text-sm px-2 sm:px-4",
                    activeTab === item.id 
                      ? "bg-background text-primary shadow-sm hover:bg-background" 
                      : "text-muted-foreground hover:bg-transparent hover:text-primary"
                  )}
                  onClick={() => setActiveTab(item.id as SettingsTab)}
                >
                  <item.icon className="h-4 w-4 mr-1.5 sm:mr-2 shrink-0" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 px-1">
          {activeTab === "profile" && !isStudent && (
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal information and instructor preferences.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <ProfileSettingsForm />
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && !isStudent && (
            <div className="space-y-6">
              <NotificationSettingsForm />
            </div>
          )}

          {activeTab === "menu" && !isStudent && (
            <Card className="border-none shadow-sm bg-card overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle>Customise Menu</CardTitle>
                <CardDescription>Rearrange or hide pages in your sidebar navigation.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <MenuCustomizer />
              </CardContent>
            </Card>
          )}

          {activeTab === "account" && (
            <div className="space-y-6">
              {!isStudent && (
                <Card className="border-none shadow-sm bg-card overflow-hidden">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      Change Login Email
                    </CardTitle>
                    <CardDescription>Update the email address you use to sign in to your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <ChangeEmailForm />
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm bg-card overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Change Password
                  </CardTitle>
                  <CardDescription>Update your login credentials to keep your account secure.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <ChangePasswordForm />
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5 shadow-none overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-destructive text-lg">Sign Out</CardTitle>
                  <CardDescription>End your current session on this device.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                  <Button 
                    variant="destructive" 
                    className="w-full font-bold h-12" 
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Logout of App
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;