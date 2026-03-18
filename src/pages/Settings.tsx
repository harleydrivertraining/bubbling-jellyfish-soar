"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutList, UserCog, ShieldCheck, Bell, ChevronRight } from "lucide-react";
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
      <h1 className="text-3xl font-black tracking-tight">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-between font-bold h-12 px-4",
                activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
              onClick={() => setActiveTab(item.id as SettingsTab)}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
              <ChevronRight className={cn("h-4 w-4 transition-transform", activeTab === item.id ? "rotate-90" : "")} />
            </Button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 animate-in fade-in slide-in-from-right-4 duration-300">
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Manage your personal information and app preferences.</CardDescription>
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
            <Card>
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
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your login credentials.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChangePasswordForm />
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive">Account Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="destructive" 
                    className="w-full font-bold" 
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