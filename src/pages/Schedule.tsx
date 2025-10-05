"use client";

import React, { useState, useCallback } from "react";
import CalendarComponent from "@/components/Calendar";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddBookingForm from "@/components/AddBookingForm";
import { addMinutes } from "date-fns";

const Schedule: React.FC = () => {
  const [isAddBookingDialogOpen, setIsAddBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  const handleOpenAddBookingDialog = useCallback((start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setIsAddBookingDialogOpen(true);
  }, []);

  const handleBookingAdded = useCallback(() => {
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
    // The CalendarComponent will refetch its events internally
  }, []);

  const handleCloseAddBookingDialog = useCallback(() => {
    setIsAddBookingDialogOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleMakeNewBookingClick = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    // Round up to the next 15-minute interval
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
    const defaultEndTime = addMinutes(defaultStartTime, 60); // Default to 1 hour lesson

    handleOpenAddBookingDialog(defaultStartTime, defaultEndTime);
  };

  return (
    <div className="flex flex-col space-y-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <Button onClick={handleMakeNewBookingClick}>
          <PlusCircle className="mr-2 h-4 w-4" /> Make New Booking
        </Button>
      </div>
      <div className="flex-1 min-h-[600px]">
        <CalendarComponent onSelectSlot={handleOpenAddBookingDialog} />
      </div>

      <Dialog open={isAddBookingDialogOpen} onOpenChange={handleCloseAddBookingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Booking</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <AddBookingForm
              initialStartTime={selectedSlot.start}
              initialEndTime={selectedSlot.end}
              onBookingAdded={handleBookingAdded}
              onClose={handleCloseAddBookingDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;