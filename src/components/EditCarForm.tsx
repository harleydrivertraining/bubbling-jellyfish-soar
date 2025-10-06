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
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import CarImageUploadCard from "@/components/CarImageUploadCard"; // Import CarImageUploadCard

const formSchema = z.object({
  make: z.string().min(1, { message: "Car make is required." }),
  model: z.string().min(1, { message: "Car model is required." }),
  year: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1900).max(new Date().getFullYear() + 1, { message: "Invalid year." })
  ),
  acquisition_date: z.date({ required_error: "Acquisition date is required." }),
  initial_mileage: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: "Initial mileage cannot be negative." })
  ),
  service_interval_miles: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(1, { message: "Service interval must be at least 1 mile." }).nullable().optional()
  ),
  car_image_url: z.string().url({ message: "Must be a valid URL." }).optional().nullable().or(z.literal("")), // Add car_image_url to schema
});

interface EditCarFormProps {
  carId: string;
  onCarUpdated: () => void;
  onCarDeleted: () => void;
  onClose: () => void;
}

const EditCarForm: React.FC<EditCarFormProps> = ({ carId, onCarUpdated, onCarDeleted, onClose }) => {
  const { user } = useSession();
  const [isLoadingCar, setIsLoadingCar] = useState(true);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // State to hold the image URL

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      acquisition_date: new Date(),
      initial_mileage: 0,
      service_interval_miles: 10000,
      car_image_url: "", // Default for new field
    },
  });

  useEffect(() => {
    const fetchCarDetails = async () => {
      if (!user || !carId) return;
      setIsLoadingCar(true);
      const { data, error } = await supabase
        .from("cars")
        .select("make, model, year, acquisition_date, initial_mileage, service_interval_miles, car_image_url")
        .eq("id", carId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching car details:", error);
        showError("Failed to load car details: " + error.message);
        onClose();
      } else if (data) {
        form.reset({
          make: data.make,
          model: data.model,
          year: data.year,
          acquisition_date: new Date(data.acquisition_date),
          initial_mileage: data.initial_mileage,
          service_interval_miles: data.service_interval_miles,
          car_image_url: data.car_image_url || "", // Set car_image_url from fetched data
        });
        setCurrentImageUrl(data.car_image_url); // Update local state for CarImageUploadCard
      }
      setIsLoadingCar(false);
    };

    fetchCarDetails();
  }, [carId, user, form, onClose]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to update a car.");
      return;
    }

    const { error } = await supabase
      .from("cars")
      .update({
        make: values.make,
        model: values.model,
        year: values.year,
        acquisition_date: format(values.acquisition_date, "yyyy-MM-dd"),
        initial_mileage: values.initial_mileage,
        service_interval_miles: values.service_interval_miles,
        // car_image_url is updated directly by CarImageUploadCard, no need to include here
      })
      .eq("id", carId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating car:", error);
      showError("Failed to update car: " + error.message);
    } else {
      showSuccess("Car details updated successfully!");
      onCarUpdated(); // Trigger refresh in parent
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a car.");
      return;
    }

    const { error } = await supabase
      .from("cars")
      .delete()
      .eq("id", carId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting car:", error);
      showError("Failed to delete car: " + error.message);
    } else {
      showSuccess("Car deleted successfully!");
      onCarDeleted();
    }
  };

  const handleImageUploaded = (newUrl: string | null) => {
    setCurrentImageUrl(newUrl); // Update local state
    onCarUpdated(); // Trigger parent to re-fetch cars and update image on MileageTracker
  };

  if (isLoadingCar) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
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
        <CarImageUploadCard
          carId={carId}
          currentImageUrl={currentImageUrl}
          carMakeModel={`${form.watch("make")} ${form.watch("model")}`}
          onImageUploaded={handleImageUploaded}
        />
        <FormField
          control={form.control}
          name="make"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Make</FormLabel>
              <FormControl>
                <Input placeholder="Toyota" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input placeholder="Corolla" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year</FormLabel>
              <FormControl>
                <Input type="number" placeholder="2020" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acquisition_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Acquisition Date</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  setDate={field.onChange}
                  placeholder="Select date"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initial_mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Mileage (at acquisition)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 1000.0"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="service_interval_miles"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Interval (miles)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="e.g., 10000"
                  {...field}
                  value={field.value === null ? "" : field.value}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">Update Car Details</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1">Delete Car</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this car and all associated mileage entries.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </Form>
  );
};

export default EditCarForm;