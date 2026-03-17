"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutList, UserCog, ShieldCheck, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";
import NotificationSettingsForm from "@/components/NotificationSettingsForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import MenuCustomizer from "@/components/MenuCustomizer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Settings: React.FC = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black tracking-tight">Settings</h1>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12">
          <TabsTrigger value="profile" className="font-bold flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="font-bold flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="menu" className="font-bold flex items-center gap-2">
            <LayoutList className="h-4 w-4" /> Menu
          </TabsTrigger>
          <TabsTrigger value="account" className="font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your personal information and app preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProfileSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettingsForm />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customise Menu</CardTitle>
              <CardDescription>Rearrange or hide pages in your sidebar navigation.</CardDescription>
            </CardHeader>
            <CardContent>
              <MenuCustomizer />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your login credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;