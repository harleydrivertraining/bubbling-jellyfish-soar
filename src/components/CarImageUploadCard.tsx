"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Car, UploadCloud, Image as ImageIcon, XCircle, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Progress } from "@/components/ui/progress"; // Import Progress component

interface CarImageUploadCardProps {
  carId: string;
  currentImageUrl: string | null;
  carMakeModel: string;
  onImageUploaded: (newUrl: string | null) => void;
}

const CarImageUploadCard: React.FC<CarImageUploadCardProps> = ({
  carId,
  currentImageUrl,
  carMakeModel,
  onImageUploaded,
}) => {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState<string>(currentImageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);

  useEffect(() => {
    setPreviewUrl(currentImageUrl);
    setUrlInput(currentImageUrl || ""); // Keep URL input in sync with current image
  }, [currentImageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile)); // Create a local preview
      setUrlInput(""); // Clear URL input when a file is selected
    } else {
      setFile(null);
      setPreviewUrl(currentImageUrl); // Revert to current image if no file selected
    }
  };

  const handleUrlInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setUrlInput(newUrl);
    setFile(null); // Clear any selected file when typing a URL
    setPreviewUrl(newUrl || currentImageUrl); // Update preview with new URL or revert
  };

  const handleUpload = async () => {
    if (!user) {
      showError("You must be logged in to upload an image.");
      return;
    }
    if (!file) {
      showError("Please select an image to upload.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const fileExt = file.name.split('.').pop();
    const fileName = `${carId}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('car-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        onUploadProgress: (event) => {
          if (event.totalBytes > 0) {
            setUploadProgress(Math.round((event.bytesUploaded / event.totalBytes) * 100));
          }
        },
      });

    if (uploadError) {
      console.error("Error uploading car image:", uploadError);
      showError("Failed to upload image: " + uploadError.message);
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('car-images')
      .getPublicUrl(filePath);
    
    const newImageUrl = publicUrlData.publicUrl;

    // Update the car's record in the database with the new image URL
    const { error: updateError } = await supabase
      .from('cars')
      .update({ car_image_url: newImageUrl })
      .eq('id', carId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error updating car image URL in DB:", updateError);
      showError("Failed to save image URL: " + updateError.message);
      // Optionally, delete the uploaded file from storage if DB update fails
    } else {
      showSuccess("Car image uploaded and updated successfully!");
      onImageUploaded(newImageUrl); // Notify parent component
      setFile(null); // Clear selected file
      setUrlInput(newImageUrl); // Keep URL input in sync
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleSetImageUrl = async () => {
    if (!user) {
      showError("You must be logged in to set an image URL.");
      return;
    }
    if (!urlInput.trim()) {
      showError("Please enter a valid URL.");
      return;
    }
    // Basic URL validation
    try {
      new URL(urlInput);
    } catch (_) {
      showError("Please enter a valid URL format.");
      return;
    }

    setUploading(true); // Use uploading state for both operations
    setUploadProgress(0); // Reset progress for URL set

    const { error: updateError } = await supabase
      .from('cars')
      .update({ car_image_url: urlInput.trim() })
      .eq('id', carId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error updating car image URL in DB:", updateError);
      showError("Failed to save image URL: " + updateError.message);
    } else {
      showSuccess("Car image URL updated successfully!");
      onImageUploaded(urlInput.trim());
      setFile(null); // Clear any selected file
    }
    setUploading(false);
  };

  const handleRemoveImage = async () => {
    if (!user) {
      showError("You must be logged in to remove an image.");
      return;
    }
    if (!currentImageUrl) return;

    // If the current image is from a file upload, attempt to delete from storage
    if (currentImageUrl.includes('/storage/v1/object/public/car-images/')) {
      const urlParts = currentImageUrl.split('/public/car-images/');
      if (urlParts.length < 2) {
        showError("Could not determine file path from URL.");
        return;
      }
      const filePath = urlParts[1];

      const { error: deleteError } = await supabase.storage
        .from('car-images')
        .remove([filePath]);

      if (deleteError) {
        console.error("Error deleting image from storage:", deleteError);
        showError("Failed to delete image from storage: " + deleteError.message);
        return;
      }
    }

    // Update car record in DB to null regardless of source (file or URL)
    const { error: updateError } = await supabase
      .from('cars')
      .update({ car_image_url: null })
      .eq('id', carId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error removing car image URL from DB:", updateError);
      showError("Failed to remove image URL from database: " + updateError.message);
    } else {
      showSuccess("Car image removed successfully!");
      onImageUploaded(null); // Notify parent component
      setPreviewUrl(null);
      setFile(null);
      setUrlInput(""); // Clear URL input
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <ImageIcon className="mr-2 h-5 w-5 text-muted-foreground" />
          Car Image
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4 p-4">
        <Avatar className="h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/20">
          <AvatarImage src={previewUrl || undefined} alt={`${carMakeModel} image`} className="object-cover" />
          <AvatarFallback className="rounded-lg flex flex-col items-center justify-center text-muted-foreground text-center p-2">
            <Car className="h-10 w-10 mb-2" />
            <span className="text-sm">No Image</span>
          </AvatarFallback>
        </Avatar>

        <div className="w-full space-y-2">
          <div className="space-y-1">
            <Input
              id="car-image-url"
              type="url"
              placeholder="Paste image URL here (e.g., https://example.com/car.jpg)"
              value={urlInput}
              onChange={handleUrlInputChange}
              disabled={uploading}
            />
            <Button
              onClick={handleSetImageUrl}
              disabled={!urlInput.trim() || uploading}
              className="w-full"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Set Image from URL
            </Button>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-muted-foreground/20"></div>
            <span className="flex-shrink mx-4 text-muted-foreground text-sm">OR</span>
            <div className="flex-grow border-t border-muted-foreground/20"></div>
          </div>

          <Input
            id="car-image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="file:text-primary file:bg-primary-foreground file:border-primary"
          />
          {uploading && file && <Progress value={uploadProgress} className="w-full" />}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {uploading && file ? `Uploading (${uploadProgress}%)` : "Upload File"}
            </Button>
            {currentImageUrl && (
              <Button
                variant="outline"
                onClick={handleRemoveImage}
                disabled={uploading}
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Remove Image
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CarImageUploadCard;