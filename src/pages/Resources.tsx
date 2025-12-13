"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Link as LinkIcon, Image as ImageIcon, Folder, Trash2, Edit, ChevronRight, Home, FileText, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import AddResourceForm from "@/components/AddResourceForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import EditResourceForm from "@/components/EditResourceForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Resource {
  id: string;
  name: string;
  image_url?: string | null;
  details?: string | null;
  resource_url?: string | null; // Now optional
  file_path?: string | null; // New field
  folder_id?: string | null;
}

interface ResourceFolder {
  id: string;
  name: string;
  parent_folder_id?: string | null;
}

const Resources: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [resources, setResources] = useState<Resource[]>([]);
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddResourceDialogOpen, setIsAddResourceDialogOpen] = useState(false);
  const [isEditResourceDialogOpen, setIsEditResourceDialogOpen] = useState(false);
  const [selectedResourceForEdit, setSelectedResourceForEdit] = useState<string | null>(null);

  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentFolder, setCurrentFolder] = useState<ResourceFolder | null>(null); // null for root

  const fetchFoldersAndResources = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // Fetch folders
    const { data: foldersData, error: foldersError } = await supabase
      .from("resource_folders")
      .select("id, name, parent_folder_id")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (foldersError) {
      console.error("Error fetching folders:", foldersError);
      showError("Failed to load folders: " + foldersError.message);
      setFolders([]);
    } else {
      setFolders(foldersData || []);
    }

    // Fetch resources
    let resourceQuery = supabase
      .from("resources")
      .select("id, name, image_url, details, resource_url, file_path, folder_id") // Explicitly select file_path
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (currentFolder === null) {
      // Fetch resources with no folder_id (root level)
      resourceQuery = resourceQuery.is("folder_id", null);
    } else {
      // Fetch resources within the current folder
      resourceQuery = resourceQuery.eq("folder_id", currentFolder.id);
    }

    const { data: resourcesData, error: resourcesError } = await resourceQuery;

    if (resourcesError) {
      console.error("Error fetching resources:", resourcesError);
      showError("Failed to load resources: " + resourcesError.message);
      setResources([]);
    } else {
      setResources(resourcesData || []);
    }
    setIsLoading(false);
  }, [user, currentFolder]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchFoldersAndResources();
    }
  }, [isSessionLoading, fetchFoldersAndResources]);

  const handleResourceAdded = () => {
    fetchFoldersAndResources();
    setIsAddResourceDialogOpen(false);
  };

  const handleCloseAddResourceDialog = () => {
    setIsAddResourceDialogOpen(false);
  };

  const handleEditResourceClick = (resourceId: string) => {
    setSelectedResourceForEdit(resourceId);
    setIsEditResourceDialogOpen(true);
  };

  const handleResourceUpdated = () => {
    fetchFoldersAndResources();
    setIsEditResourceDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleResourceDeleted = () => {
    fetchFoldersAndResources();
    setIsEditResourceDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleCloseEditResourceDialog = () => {
    setIsEditResourceDialogOpen(false);
    setSelectedResourceForEdit(null);
  };

  const handleDeleteResource = async (resource: Resource) => {
    if (!user) {
      showError("You must be logged in to delete a resource.");
      return;
    }

    // If the resource has an associated file, delete it from storage first
    if (resource.file_path && resource.file_path.includes('/storage/v1/object/public/resources/')) {
      const urlParts = resource.file_path.split('/public/resources/');
      if (urlParts.length < 2) {
        showError("Could not determine file path from URL. Cannot delete file.");
        return;
      }
      const filePathInStorage = urlParts[1];

      const { error: deleteFileError } = await supabase.storage
        .from('resources')
        .remove([filePathInStorage]);

      if (deleteFileError) {
        console.error("Error deleting file from storage:", deleteFileError);
        showError("Failed to delete associated file: " + deleteFileError.message);
        return; // Stop if file deletion fails
      }
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resource.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting resource:", error);
      showError("Failed to delete resource: " + error.message);
    } else {
      showSuccess("Resource deleted successfully!");
      fetchFoldersAndResources();
    }
  };

  const handleAddFolder = async () => {
    if (!user) {
      showError("You must be logged in to add a folder.");
      return;
    }
    if (!newFolderName.trim()) {
      showError("Folder name cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("resource_folders")
      .insert({
        user_id: user.id,
        name: newFolderName.trim(),
        parent_folder_id: currentFolder?.id || null,
      })
      .select();

    if (error) {
      console.error("Error adding folder:", error);
      showError("Failed to add folder: " + error.message);
    } else {
      showSuccess("Folder added successfully!");
      setNewFolderName("");
      setIsAddFolderDialogOpen(false);
      fetchFoldersAndResources();
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!user) {
      showError("You must be logged in to delete a folder.");
      return;
    }

    // Check if folder contains any resources or subfolders
    const { data: containedResources, error: resError } = await supabase
      .from("resources")
      .select("id")
      .eq("folder_id", folderId)
      .limit(1);

    const { data: containedFolders, error: folderError } = await supabase
      .from("resource_folders")
      .select("id")
      .eq("parent_folder_id", folderId)
      .limit(1);

    if (resError || folderError) {
      console.error("Error checking folder contents:", resError || folderError);
      showError("Failed to check folder contents. Cannot delete.");
      return;
    }

    if (containedResources.length > 0 || containedFolders.length > 0) {
      showError("Folder must be empty before it can be deleted.");
      return;
    }

    const { error } = await supabase
      .from("resource_folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting folder:", error);
      showError("Failed to delete folder: " + error.message);
    } else {
      showSuccess(`Folder "${folderName}" deleted successfully!`);
      fetchFoldersAndResources();
    }
  };

  const handleNavigateToFolder = (folder: ResourceFolder | null) => {
    setCurrentFolder(folder);
  };

  const currentPath = useMemo(() => {
    const path: ResourceFolder[] = [];
    let tempFolder = currentFolder;
    while (tempFolder) {
      path.unshift(tempFolder);
      tempFolder = folders.find(f => f.id === tempFolder?.parent_folder_id) || null;
    }
    return path;
  }, [currentFolder, folders]);

  const currentLevelFolders = useMemo(() => {
    const parentId = currentFolder?.id || null;
    return folders.filter(f => (f.parent_folder_id === parentId) || (!f.parent_folder_id && parentId === null));
  }, [folders, currentFolder]);

  const handleViewResource = (resource: Resource) => {
    const url = resource.resource_url || resource.file_path;
    if (url) {
      window.open(url, '_blank'); // Open in a new tab
    } else {
      showError("No viewable content available for this resource.");
    }
  };

  // Helper to determine icon for resource link
  const getResourceIcon = (resource: Resource) => {
    const url = resource.resource_url || resource.file_path;
    if (!url) return <FileText className="h-4 w-4 mr-1" />;

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.match(/\.(jpeg|jpg|png|gif|webp|svg)$/)) return <ImageIcon className="h-4 w-4 mr-1" />;
    if (lowerUrl.match(/\.(mp4|webm|ogg)$/)) return <Video className="h-4 w-4 mr-1" />;
    if (lowerUrl.endsWith('.pdf')) return <FileText className="h-4 w-4 mr-1" />;
    return <LinkIcon className="h-4 w-4 mr-1" />;
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
        <div className="flex gap-2">
          <Dialog open={isAddFolderDialogOpen} onOpenChange={setIsAddFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Folder className="mr-2 h-4 w-4" /> Add New Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Folder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="folderName" className="text-right">
                    Folder Name
                  </Label>
                  <Input
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <Button type="submit" onClick={handleAddFolder}>
                Add Folder
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddResourceDialogOpen} onOpenChange={setIsAddResourceDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Resource
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Resource</DialogTitle>
              </DialogHeader>
              <AddResourceForm onResourceAdded={handleResourceAdded} onClose={handleCloseAddResourceDialog} currentFolderId={currentFolder?.id || null} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-muted-foreground">Access useful driving resources and materials.</p>

      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => handleNavigateToFolder(null)} className="p-0 h-auto">
          <Home className="h-4 w-4" />
          <span className="sr-only">Home</span>
        </Button>
        {currentPath.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-4 w-4" />
            <Button variant="ghost" size="sm" onClick={() => handleNavigateToFolder(folder)} className="p-0 h-auto">
              {folder.name}
            </Button>
          </React.Fragment>
        ))}
      </nav>

      {(currentLevelFolders.length === 0 && resources.length === 0) ? (
        <p className="text-muted-foreground">No folders or resources in this location. Click "Add New Folder" or "Add New Resource" to get started!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Display Folders */}
          {currentLevelFolders.map((folder) => (
            <Card key={folder.id} className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleNavigateToFolder(folder)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center">
                  <Folder className="h-10 w-10 text-primary mr-3" />
                  <CardTitle className="text-lg font-semibold">{folder.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  {/* Edit Folder (future enhancement) */}
                  {/* <Button variant="ghost" size="sm" className="p-0 h-auto">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit Folder</span>
                  </Button> */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-auto text-destructive hover:text-destructive/90" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Folder</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the folder "{folder.name}".
                          <br />
                          <span className="font-bold text-destructive">Note: The folder must be empty (no resources or subfolders) to be deleted.</span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteFolder(folder.id, folder.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="flex-1 text-sm text-muted-foreground">
                Click to open folder
              </CardContent>
            </Card>
          ))}

          {/* Display Resources */}
          {resources.map((resource) => (
            <Card key={resource.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10 rounded-md mr-3">
                    <AvatarImage src={resource.image_url || undefined} alt={`${resource.name} image`} className="object-cover" />
                    <AvatarFallback className="rounded-md">
                      {getResourceIcon(resource)}
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
                          This action cannot be undone. This will permanently delete the resource "{resource.name}" and any associated file from storage.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteResource(resource)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                {(resource.resource_url || resource.file_path) && (
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleViewResource(resource)}>
                    {getResourceIcon(resource)}
                    View Resource
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditResourceDialogOpen} onOpenChange={handleCloseEditResourceDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
          </DialogHeader>
          {selectedResourceForEdit && (
            <EditResourceForm
              resourceId={selectedResourceForEdit}
              onResourceUpdated={handleResourceUpdated}
              onResourceDeleted={handleResourceDeleted}
              onClose={handleCloseEditResourceDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Resources;