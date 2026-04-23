"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import PublicProfileSettings from "@/components/PublicProfileSettings";
import UnavailabilityManager from "@/components/UnavailabilityManager";
import { Globe, Ban } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PublicProfileManagement = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">Public Page Management</h1>
        <p className="text-muted-foreground font-medium">Control your public presence and booking restrictions.</p>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="settings" className="font-bold flex items-center gap-2">
            <Globe className="h-4 w-4" /> Profile Settings
          </TabsTrigger>
          <TabsTrigger value="unavailability" className="font-bold flex items-center gap-2">
            <Ban className="h-4 w-4" /> No-Test Dates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <Card className="border-none shadow-sm bg-card overflow-hidden">
            <CardHeader>
              <CardTitle>Public Profile Configuration</CardTitle>
              <CardDescription>Set up your public-facing page for potential students.</CardDescription>
            </CardHeader>
            <CardContent>
              <PublicProfileSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unavailability" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <UnavailabilityManager />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicProfileManagement;