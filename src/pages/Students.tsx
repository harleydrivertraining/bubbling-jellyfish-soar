"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const Students: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Students</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>John Doe - Beginner</li>
            <li>Jane Smith - Intermediate</li>
            <li>Mike Johnson - Advanced</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;