"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, Check, Trash2, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: string;
}

const NotificationBell: React.FC = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }

    const channel = supabase
      .channel(`notifications-sync-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new as Notification;
          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          
          toast(newNotif.title, {
            description: newNotif.message,
            icon: <Sparkles className="h-4 w-4 text-blue-500" />,
          });

          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: newNotif.title,
                    body: newNotif.message,
                    id: Math.floor(Math.random() * 10000),
                    schedule: { at: new Date(Date.now() + 1000) },
                    sound: 'default',
                    actionTypeId: "",
                    extra: null
                  }
                ]
              });
            } catch (e) {
              console.error("Local notification failed", e);
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedNotif = payload.new as Notification;
          setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id;
          setNotifications(prev => prev.filter(n => n.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .match({ id, user_id: user.id });

    if (error) {
      console.error("Mark as read failed:", error);
      fetchNotifications();
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    // Navigation logic based on notification type
    switch (notif.type) {
      case 'booking_claimed':
        navigate('/schedule');
        break;
      case 'self_assessment':
        navigate('/pupil-self-assessments');
        break;
      case 'booking_confirmed':
      case 'booking_rejected':
        navigate('/');
        break;
      default:
        // Default behavior: just close the popover
        break;
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .match({ user_id: user.id, read: false });

    if (error) {
      console.error("Mark all as read failed:", error);
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the click handler for the notification item
    if (!user) return;

    setNotifications(prev => prev.filter(n => n.id !== id));
    
    const { error } = await supabase
      .from("notifications")
      .delete()
      .match({ id, user_id: user.id });
      
    if (error) {
      console.error("Delete failed:", error);
      fetchNotifications();
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;

    const confirmDelete = window.confirm("Are you sure you want to clear all notifications?");
    if (!confirmDelete) return;

    setNotifications([]);
    
    const { error } = await supabase
      .from("notifications")
      .delete()
      .match({ user_id: user.id });

    if (error) {
      console.error("Delete all failed:", error);
      fetchNotifications();
    } else {
      toast.success("All notifications cleared.");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-primary transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 bg-red-600 text-white border border-white text-[8px] font-bold">
              {unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mb-2" align="end" side="top">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-sm">Notifications</h3>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-[10px] h-7 font-bold uppercase" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-[10px] h-7 font-bold uppercase text-destructive hover:text-destructive" onClick={deleteAllNotifications}>
                Clear All
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm italic">
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-4 space-y-1 transition-colors relative group cursor-pointer",
                    !notif.read ? "bg-blue-50/50" : "hover:bg-muted/30"
                  )}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className={cn("text-sm font-bold leading-tight", !notif.read && "text-blue-700")}>
                      {notif.title}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive" 
                        onClick={(e) => deleteNotification(notif.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium pt-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(notif.created_at), "MMM d, p")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;