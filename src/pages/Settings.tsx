"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ProfileSettingsForm from "@/components/ProfileSettingsForm"; // Import the new component

const Settings: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileSettingsForm />
        </CardContent>
      </Card>
      {/* Other settings cards can go here */}
    </div>
  );
};

export default Settings;