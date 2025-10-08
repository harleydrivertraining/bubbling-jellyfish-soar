"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Link as LinkIcon, Image as ImageIcon, FileText, Trash2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import AddResourceForm from "@/components/AddResourceForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import EditResourceForm from "@/components/EditResourceForm"; // Will create this next

interface Resource {
  id: string;
  name: string;
  image_url?: string | null;
  details?: string | null;
  resource_url: string;
}

const Resources: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedResourceForEdit, setSelectedResourceForEdit] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("resources")
      .select("id, name, image_url, details, resource_url")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching resources:", error);
      showError("Failed to load resources: " + error.message);
      setResources([]);
    } else {
      setResources(data || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchResources();
    }
  }, [isSessionLoading, fetchResources]);

  const handleResourceAdded = () => {
    fetchResources();
    setIsAddDialogOpen(false);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
  };

  const handleEditResourceClick = (resourceId: string) => {
    setSelectedResourceForEdit(resourceId);
    setIsEditDialogOpen(true);
  };

  const handleResourceUpdated = () => {
    fetchResources();
    setIsEditDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleResourceDeleted = () => {
    fetchResources();
    setIsEditDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!user) {
      showError("You must be logged in to delete a resource.");
      return;
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resourceId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting resource:", error);
      showError("Failed to delete resource: " + error.message);
    } else {
      showSuccess("Resource deleted successfully!");
      fetchResources();
    }
  };

  if (isSessionLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Resources</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Resource</DialogTitle>
            </DialogHeader>
            <AddResourceForm onResourceAdded={handleResourceAdded} onClose={handleCloseAddDialog} />
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-muted-foreground">Access useful driving resources and materials.</p>

      {resources.length === 0 ? (
        <p className="text-muted-foreground">No resources added yet. Click "Add New Resource" to get started!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resources.map((resource) => (
            <Card key={resource.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10 rounded-md mr-3">
                    <AvatarImage src={resource.image_url || undefined} alt={`${resource.name} image`} className="object-cover" />
                    <AvatarFallback className="rounded-md">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg font-semibold">{resource.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditResourceClick(resource.id)} className="p-0 h-auto">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-auto text-destructive hover:text-destructive/90">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the resource "{resource.name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteResource(resource.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                {resource.details && (
                  <CardDescription className="text-muted-foreground">{resource.details}</CardDescription>
                )}
                <a
                  href={resource.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-500 hover:underline mt-2"
                >
                  <LinkIcon className="h-4 w-4 mr-1" /> View Resource
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
          </DialogHeader>
          {selectedResourceForEdit && (
            <EditResourceForm
              resourceId={selectedResourceForEdit}
              onResourceUpdated={handleResourceUpdated}
              onResourceDeleted={handleResourceDeleted}
              onClose={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Resources;