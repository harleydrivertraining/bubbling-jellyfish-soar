"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  ChevronRight, 
  X,
  ClipboardCheck,
  Bell
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface BookingRequest {
  id: string;
  start_time: string;
  status: string;
  type: 'pending' | 'accepted' | 'rejected';
  title: string;
  message?: string;
  notificationId?: string;
}

interface StudentBookingStatusCardProps {
  requests: BookingRequest[];
  onDismiss: (notificationId: string) => void;
}

const StudentBookingStatusCard: React.FC<StudentBookingStatusCardProps> = ({ requests, onDismiss }) => {
  if (requests.length === 0) return null;

  return (
    <Card className="shadow-md border-none overflow-hidden">
      <CardHeader className="bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary/60" />
              Booking Activity
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              Track the status of your recent lesson requests.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-background font-bold">
            {requests.length} {requests.length === 1 ? 'Item' : 'Items'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {requests.map((item, index) => (
            <div 
              key={item.id || index} 
              className={cn(
                "p-4 flex items-start justify-between gap-4 transition-colors",
                item.type === 'pending' ? "bg-orange-50/30" : 
                item.type === 'accepted' ? "bg-green-50/30" : "bg-red-50/30"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border",
                  item.type === 'pending' ? "bg-orange-100 text-orange-600 border-orange-200" : 
                  item.type === 'accepted' ? "bg-green-100 text-green-600 border-green-200" : 
                  "bg-red-100 text-red-600 border-red-200"
                )}>
                  {item.type === 'pending' ? <Clock className="h-5 w-5" /> : 
                   item.type === 'accepted' ? <CheckCircle2 className="h-5 w-5" /> : 
                   <XCircle className="h-5 w-5" />}
                </div>
                
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">
                      {item.type === 'pending' ? "Request Sent" : 
                       item.type === 'accepted' ? "Booking Confirmed!" : 
                       "Request Declined"}
                    </p>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] font-black uppercase px-1.5 h-4",
                        item.type === 'pending' ? "text-orange-600 border-orange-200 bg-white" : 
                        item.type === 'accepted' ? "text-green-600 border-green-200 bg-white" : 
                        "text-red-600 border-red-200 bg-white"
                      )}
                    >
                      {item.type}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(item.start_time), "EEEE, MMM do 'at' p")}
                  </p>
                  
                  {item.message && (
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed mt-1">
                      {item.message}
                    </p>
                  )}
                </div>
              </div>

              {item.notificationId && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => onDismiss(item.notificationId!)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentBookingStatusCard;