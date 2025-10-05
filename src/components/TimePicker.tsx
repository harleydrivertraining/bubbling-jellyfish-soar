"use client";

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  date: Date | undefined;
  onChange: (newDate: Date | undefined) => void;
  label?: string;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ date, onChange, label, disabled }) => {
  const hours = date ? date.getHours() : 0;
  const minutes = date ? date.getMinutes() : 0;

  const handleHourChange = (value: string) => {
    const newHours = parseInt(value, 10);
    const newDate = date ? new Date(date) : new Date(); // Use current date if date is undefined
    newDate.setHours(newHours);
    onChange(newDate);
  };

  const handleMinuteChange = (value: string) => {
    const newMinutes = parseInt(value, 10);
    const newDate = date ? new Date(date) : new Date(); // Use current date if date is undefined
    newDate.setMinutes(newMinutes);
    onChange(newDate);
  };

  const generateHours = () => {
    const hoursArray = [];
    for (let i = 0; i < 24; i++) {
      hoursArray.push(i.toString().padStart(2, '0'));
    }
    return hoursArray;
  };

  const generateMinutes = () => {
    const minutesArray = [];
    for (let i = 0; i < 60; i += 5) { // Increment by 5 minutes
      minutesArray.push(i.toString().padStart(2, '0'));
    }
    return minutesArray;
  };

  return (
    <div className={cn("flex items-end gap-2", disabled && "opacity-50 cursor-not-allowed")}>
      {label && <Label className="sr-only">{label}</Label>}
      <div className="grid gap-1">
        {/* Removed "Hour" label */}
        <Select onValueChange={handleHourChange} value={hours.toString().padStart(2, '0')} disabled={disabled}>
          <SelectTrigger id={`${label}-hour`} className="w-[70px]">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {generateHours().map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        {/* Removed "Minute" label */}
        <Select onValueChange={handleMinuteChange} value={minutes.toString().padStart(2, '0')} disabled={disabled}>
          <SelectTrigger id={`${label}-minute`} className="w-[70px]">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {generateMinutes().map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TimePicker;