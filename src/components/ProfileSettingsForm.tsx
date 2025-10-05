"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, UploadCloud } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  hourly_rate: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0, { message: "Hourly rate cannot be negative." }).nullable().optional()
  ),
  logo_file: typeof window === 'undefined' ? z.any().optional() : z.instanceof(FileList).optional().nullable(),
});

interface ProfileSettingsFormProps {
  onProfileUpdated?: () => void;
}

const ProfileSettingsForm: React.FC<ProfileSettingsFormProps> = ({ onProfileUpdated }) => {
  const { user } = useSession();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      hourly_rate: null,
      logo_file: null,
    },
  });

  const fetchProfile = async () => {
    if (!user) return;
    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, hourly_rate, logo_url")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      showError("Failed to load profile: " + error.message);
    } else if (data) {
      form.reset({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        hourly_rate: data.hourly_rate,
        logo_file: null, // Reset file input
      });
      setCurrentLogoUrl(data.logo_url);
      setLogoPreview(null); // Clear preview when new profile data is loaded
    }
    setIsLoadingProfile(false);
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      form.setValue("logo_file", files);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      form.setValue("logo_file", null);
      setLogoPreview(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update your profile.");
      return;
    }

    let newLogoUrl: string | null = currentLogoUrl;

    if (values.logo_file && values.logo_file.length > 0) {
      const file = values.logo_file[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to 'profile-logos' bucket
      const { error: uploadError } = await supabase.storage
        .from('profile-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading logo:", uploadError);
        showError("Failed to upload logo: " + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('profile-logos')
        .getPublicUrl(filePath);
      
      newLogoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        hourly_rate: values.hourly_rate,
        logo_url: newLogoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      showError("Failed to update profile: " + error.message);
    } else {
      showSuccess("Profile updated successfully!");
      fetchProfile(); // Re-fetch to ensure latest data and clear file input
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={logoPreview || currentLogoUrl || undefined} alt="Logo" />
            <AvatarFallback>
              <UserIcon className="h-10 w-10 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <FormField
            control={form.control}
            name="logo_file"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel htmlFor="logo-upload" className="cursor-pointer flex items-center gap-2 text-primary hover:underline">
                  <UploadCloud className="h-5 w-5" /> Upload New Logo
                </FormLabel>
                <FormControl>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFileChange}
                    {...fieldProps}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input placeholder="John" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input placeholder="Doe" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hourly_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hourly Lesson Rate (£)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 35.00"
                  {...field}
                  value={field.value === null ? "" : field.value}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    </Form>
  );
};

export default ProfileSettingsForm;