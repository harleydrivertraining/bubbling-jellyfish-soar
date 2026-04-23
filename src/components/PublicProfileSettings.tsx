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
import { Globe, ExternalLink, Copy, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const formSchema = z.object({
  is_public: z.boolean().default(false),
  public_slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed").optional().nullable().or(z.literal("")),
  public_bio: z.string().max(500, "Bio must be under 500 characters").optional().nullable().or(z.literal("")),
});

const PublicProfileSettings = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      is_public: false,
      public_slug: "",
      public_bio: "",
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_public, public_slug, public_bio")
        .eq("id", user.id)
        .single();
      
      if (data) {
        form.reset({
          is_public: data.is_public ?? false,
          public_slug: data.public_slug || "",
          public_bio: data.public_bio || "",
        });
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_public: values.is_public,
          public_slug: values.public_slug?.trim() || null,
          public_bio: values.public_bio?.trim() || null,
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

  if (isLoading) return <Loader2 className="h-8 w-8 animate-spin mx-auto" />;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-none shadow-none bg-muted/30">
          <CardContent className="p-4 space-y-4">
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
                      Allow anyone with the link to view your prices and availability.
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

        <Button type="submit" className="w-full font-bold h-12" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Save Public Profile Settings
        </Button>
      </form>
    </Form>
  );
};

export default PublicProfileSettings;