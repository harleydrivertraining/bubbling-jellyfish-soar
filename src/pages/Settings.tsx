"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutList, UserCog, ShieldCheck, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import NotificationSettingsForm from "@/components/NotificationSettingsForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import MenuCustomizer from "@/components/MenuCustomizer";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "notifications" | "menu" | "account";

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { id: "profile", label: "Profile", icon: UserCog },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "menu", label: "Menu", icon: LayoutList },
    { id: "account", label: "Security", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-medium">Manage your account, notifications, and app preferences.</p>
      </div>
      
      <div className="space-y-6">
        {/* Top Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border w-full overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={cn(
                "flex-1 min-w-[120px] font-bold h-10 rounded-lg transition-all",
                activeTab === item.id 
                  ? "bg-background text-primary shadow-sm hover:bg-background" 
                  : "text-muted-foreground hover:bg-transparent hover:text-primary"
              )}
              onClick={() => setActiveTab(item.id as SettingsTab)}
            >
              <item.icon className="h-4 w-4 mr-2 shrink-0" />
              {item.label}
            </Button>
          ))}
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {activeTab === "profile" && (
            <Card className="border-none shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal information and instructor preferences.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileSettingsForm />
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <NotificationSettingsForm />
          )}

          {activeTab === "menu" && (
            <Card className="border-none shadow-sm bg-card">
              <CardHeader>
                <CardTitle>Customise Menu</CardTitle>
                <CardDescription>Rearrange or hide pages in your sidebar navigation.</CardDescription>
              </CardHeader>
              <CardContent>
                <MenuCustomizer />
              </CardContent>
            </Card>
          )}

          {activeTab === "account" && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-card">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your login credentials to keep your account secure.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChangePasswordForm />
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5 shadow-none">
                <CardHeader>
                  <CardTitle className="text-destructive text-lg">Danger Zone</CardTitle>
                  <CardDescription>Actions that affect your current session.</CardDescription>
                </CardHeader>
                <CardContent>
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