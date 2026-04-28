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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Globe, ExternalLink, Copy, Loader2, ShieldCheck, Car, Upload, X, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const formSchema = z.object({
  is_public: z.boolean().default(false),
  show_availability_publicly: z.boolean().default(false),
  auto_hide_test_dates: z.boolean().default(true),
  public_slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed").optional().nullable().or(z.literal("")),
  public_bio: z.string().max(500, "Bio must be under 500 characters").optional().nullable().or(z.literal("")),
  logo_url: z.string().optional().nullable().or(z.literal("")),
});

const PublicProfileSettings = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      is_public: false,
      show_availability_publicly: false,
      auto_hide_test_dates: true,
      public_slug: "",
      public_bio: "",
      logo_url: "",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_public, show_availability_publicly, public_slug, public_bio, auto_hide_test_dates, logo_url")
        .eq("id", user.id)
        .single();
      
      if (data) {
        form.reset({
          is_public: data.is_public ?? false,
          show_availability_publicly: data.show_availability_publicly ?? false,
          auto_hide_test_dates: data.auto_hide_test_dates ?? true,
          public_slug: data.public_slug || "",
          public_bio: data.public_bio || "",
          logo_url: data.logo_url || "",
        });
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, [user, form]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      showError("Please upload an image file.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('storage2')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('storage2')
        .getPublicUrl(fileName);

      form.setValue("logo_url", publicUrl);
      showSuccess("Logo uploaded! Remember to save your changes.");
    } catch (error: any) {
      console.error("Upload error:", error);
      showError("Failed to upload image: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = () => {
    form.setValue("logo_url", "");
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_public: values.is_public,
          show_availability_publicly: values.show_availability_publicly,
          auto_hide_test_dates: values.auto_hide_test_dates,
          public_slug: values.public_slug?.trim() || null,
          public_bio: values.public_bio?.trim() || null,
          logo_url: values.logo_url || null,
        })
        .eq("id", user!.id);

      if (error) {
        if (error.code === '23505') throw new Error("This URL slug is already taken. Please try another.");
        throw error;
      }

      showSuccess("Public profile updated!");
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const publicUrl = `${window.location.origin}/instructor/${form.watch("public_slug") || user?.id}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    showSuccess("URL copied to clipboard!");
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-none shadow-none bg-muted/30">
          <CardContent className="p-4 space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-bold uppercase text-muted-foreground">Profile Logo</Label>
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-background rounded-lg border shadow-sm">
                <Avatar className="h-24 w-24 border-2 border-muted">
                  <AvatarImage src={form.watch("logo_url") || undefined} className="object-contain" />
                  <AvatarFallback className="bg-muted">
                    <Car className="h-10 w-10 text-muted-foreground/40" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="font-bold relative"
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {form.watch("logo_url") ? "Change Logo" : "Upload Logo"}
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </Button>
                    
                    {form.watch("logo_url") && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive font-bold"
                        onClick={removeLogo}
                      >
                        <X className="h-4 w-4 mr-2" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Recommended: Square image, max 2MB. This logo will appear on your public page and student dashboard.
                  </p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="is_public"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-bold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Enable Public Profile
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Allow anyone with the link to view your prices and bio.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="show_availability_publicly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-bold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-green-600" />
                      Show Availability Publicly
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Display your "Available" lesson slots on your public page.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_hide_test_dates"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-background p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-bold flex items-center gap-2">
                      <Car className="h-4 w-4 text-blue-600" />
                      Auto-hide Test Dates
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Automatically show dates with existing test bookings as "No Test" dates.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("is_public") && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
                  <Label className="text-[10px] font-bold uppercase text-primary">Your Public URL</Label>
                  <div className="flex gap-2">
                    <Input value={publicUrl} readOnly className="bg-background font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" asChild>
                      <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="public_slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom URL Slug</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">/instructor/</span>
                          <Input placeholder="your-name" {...field} value={field.value || ""} />
                        </div>
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Create a memorable link (e.g., instructor-john).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="public_bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell potential students about your experience, car, and teaching style..." 
                          className="min-h-[100px]"
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting || isUploading}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Save Public Profile Settings
        </Button>
      </form>
    </Form>
  );
};

export default PublicProfileSettings;