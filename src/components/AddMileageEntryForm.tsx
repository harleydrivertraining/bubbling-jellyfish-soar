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
import { Textarea } from "@/components/ui/textarea";
import DatePicker from "@/components/DatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { format } from "date-fns";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
}

const formSchema = z.object({
  car_id: z.string().min(1, { message: "Please select a car." }),
  entry_date: z.date({ required_error: "Entry date is required." }),
  current_mileage: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: "Current mileage cannot be negative." })
  ),
  notes: z.string().optional().nullable(),
});

interface AddMileageEntryFormProps {
  onEntryAdded: () => void;
  onClose: () => void;
  initialDate?: Date;
  initialCarId?: string;
}

const AddMileageEntryForm: React.FC<AddMileageEntryFormProps> = ({ onEntryAdded, onClose, initialDate, initialCarId }) => {
  const { user } = useSession();
  const [cars, setCars] = useState<Car[]>([]);
  const [isLoadingCars, setIsLoadingCars] = useState(true);
  const [openCarSelect, setOpenCarSelect] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      car_id: initialCarId || "",
      entry_date: initialDate || new Date(),
      current_mileage: 0,
      notes: "",
    },
  });

  useEffect(() => {
    const fetchCars = async () => {
      if (!user) return;
      setIsLoadingCars(true);
      const { data, error } = await supabase
        .from("cars")
        .select("id, make, model, year")
        .eq("user_id", user.id)
        .order("make", { ascending: true });

      if (error) {
        console.error("Error fetching cars for mileage entry form:", error);
        showError("Failed to load cars: " + error.message);
        setCars([]);
      } else {
        setCars(data || []);
      }
      setIsLoadingCars(false);
    };

    fetchCars();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in to add a mileage entry.");
      return;
    }

    const { error } = await supabase
      .from("car_mileage_entries")
      .insert({
        user_id: user.id,
        car_id: values.car_id,
        entry_date: format(values.entry_date, "yyyy-MM-dd"),
        current_mileage: values.current_mileage,
        notes: values.notes,
      })
      .select();

    if (error) {
      console.error("Error adding mileage entry:", error);
      showError("Failed to add mileage entry: " + error.message);
    } else {
      showSuccess("Mileage entry added successfully!");
      form.reset();
      onEntryAdded();
      onClose();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="car_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Car</FormLabel>
              <Popover open={openCarSelect} onOpenChange={setOpenCarSelect}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoadingCars}
                    >
                      {field.value
                        ? cars.find((car) => car.id === field.value)?.make + " " + cars.find((car) => car.id === field.value)?.model
                        : "Select a car"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search car..." />
                    <CommandEmpty>No car found. Add one first!</CommandEmpty>
                    <CommandGroup>
                      {cars.map((car) => (
                        <CommandItem
                          value={`${car.make} ${car.model}`}
                          key={car.id}
                          onSelect={() => {
                            form.setValue("car_id", car.id);
                            setOpenCarSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              car.id === field.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {car.make} {car.model} ({car.year})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of Entry</FormLabel>
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
          name="current_mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Mileage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 12345.6"
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Fuel refill, maintenance check" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Add Mileage Entry</Button>
      </form>
    </Form>
  );
};

export default AddMileageEntryForm;