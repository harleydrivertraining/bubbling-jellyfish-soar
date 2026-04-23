"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Mail, 
  ArrowLeft, 
  ShieldCheck, 
  Search,
  RefreshCw,
  AlertTriangle,
  X,
  Activity,
  CreditCard,
  Infinity,
  Zap,
  Ban,
  Clock,
  Trash2,
  Loader2,
  Fingerprint,
  CalendarDays,
  KeyRound
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/avatar";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import EditInstructorSubscription from "@/components/EditInstructorSubscription";
import AdminChangePasswordForm from "@/components/AdminChangePasswordForm";
import { cn } from "@/lib/utils";

interface InstructorProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  logo_url: string | null;
  student_count: number;
  updated_at: string;
  subscription_status: string | null;
  subscription_expiry: string | null;
  role: string | null;
}

const AdminInstructors: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instructors, setInstructors] = useState<InstructorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [selectedInstructor, setSelectedInstructor] = useState<InstructorProfile | null>(null);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const fetchInstructors = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setErrorDetail(null);

    try {
      const { data: myProfile, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      if (roleError) throw new Error("Could not verify your user role: " + roleError.message);
      
      if (myProfile?.role?.toLowerCase() !== 'owner') {
        navigate("/");
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .rpc('get_all_users_for_admin');

      if (profilesError) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, logo_url, role, updated_at, subscription_status, subscription_expiry")
          .order("updated_at", { ascending: false });
        
        if (fallbackError) throw fallbackError;
        processProfiles(fallbackData || []);
      } else {
        processProfiles(profiles || []);
      }
    } catch (error: any) {
      console.error("Error fetching instructors:", error);
      setErrorDetail(error.message);
      showError("Failed to load instructor list.");
    } finally {
      setIsLoading(false);
    }
  }, [user, navigate]);

  const processProfiles = async (profiles: any[]) => {
    const filteredProfiles = (profiles || []).filter(p => p.role?.toLowerCase() !== 'student');

    let countMap: Record<string, number> = {};
    try {
      const { data: studentCounts } = await supabase
        .from("students")
        .select("user_id");
      
      studentCounts?.forEach(s => {
        if (s.user_id) {
          countMap[s.user_id] = (countMap[s.user_id] || 0) + 1;
        }
      });
    } catch (e) {
      console.warn("Could not fetch student counts:", e);
    }

    const formatted: InstructorProfile[] = filteredProfiles.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      logo_url: p.logo_url,
      student_count: countMap[p.id] || 0,
      updated_at: p.updated_at,
      subscription_status: p.subscription_status,
      subscription_expiry: p.subscription_expiry,
      role: p.role
    }));

    setInstructors(formatted);
  };

  useEffect(() => {
    if (!isSessionLoading) fetchInstructors();
  }, [isSessionLoading, fetchInstructors]);

  const handleDeleteAccount = async (instructorId: string) => {
    setIsDeleting(instructorId);
    try {
      const { error } = await supabase.rpc('delete_user_account', { 
        target_user_id: instructorId 
      });
      if (error) throw error;
      showSuccess("Account permanently deleted.");
      fetchInstructors();
    } catch (error: any) {
      console.error("Deletion error:", error);
      showError("Failed to delete account: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredInstructors = instructors.filter(i => {
    const fullName = `${i.first_name || ''} ${i.last_name || ''}`.toLowerCase();
    const email = (i.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const handleManageSub = (instructor: InstructorProfile) => {
    setSelectedInstructor(instructor);
    setIsSubOpen(true);
  };

  const handleManagePassword = (instructor: InstructorProfile) => {
    setSelectedInstructor(instructor);
    setIsPasswordOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600"><Zap className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'lifetime':
        return <Badge className="bg-blue-600"><Infinity className="h-3 w-3 mr-1" /> Lifetime</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200"><Clock className="h-3 w-3 mr-1" /> Trial</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Ban className="h-3 w-3 mr-1" /> Inactive</Badge>;
    }
  };

  if (isSessionLoading || isLoading) {
    return <div className="space-y-6 max-w-6xl mx-auto p-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Instructor Directory
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInstructors} className="font-bold">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh List
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Platform Directory</CardTitle>
              <CardDescription>Overview of every instructor account and their subscription status.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search instructors..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">Instructor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No instructors found.</TableCell>
                  </TableRow>
                ) : (
                  filteredInstructors.map((instructor) => {
                    const isExpired = instructor.subscription_expiry && isBefore(parseISO(instructor.subscription_expiry), startOfDay(new Date()));
                    
                    return (
                      <TableRow key={instructor.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border">
                              <AvatarImage src={instructor.logo_url || undefined} />
                              <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                {instructor.first_name?.[0] || '?'}{instructor.last_name?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-bold truncate">{instructor.first_name} {instructor.last_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{instructor.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(instructor.subscription_status)}</TableCell>
                        <TableCell>
                          {instructor.subscription_expiry ? (
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs font-bold",
                              isExpired ? "text-destructive" : "text-foreground"
                            )}>
                              <CalendarDays className="h-3.5 w-3.5" />
                              {format(parseISO(instructor.subscription_expiry), "MMM d, yyyy")}
                              {isExpired && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-1">EXPIRED</Badge>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-black">{instructor.student_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => handleManagePassword(instructor)}
                              title="Change Password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="font-bold"
                              onClick={() => handleManageSub(instructor)}
                            >
                              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                              Manage
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive" disabled={isDeleting === instructor.id}>
                                  {isDeleting === instructor.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove this user and all their data.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAccount(instructor.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Manage Subscription
            </DialogTitle>
          </DialogHeader>
          {selectedInstructor && (
            <EditInstructorSubscription
              instructorId={selectedInstructor.id}
              instructorName={`${selectedInstructor.first_name} ${selectedInstructor.last_name || ''}`}
              currentStatus={selectedInstructor.subscription_status}
              currentExpiry={selectedInstructor.subscription_expiry}
              onSuccess={() => {
                setIsSubOpen(false);
                fetchInstructors();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          {selectedInstructor && (
            <AdminChangePasswordForm
              instructorId={selectedInstructor.id}
              instructorName={`${selectedInstructor.first_name} ${selectedInstructor.last_name || ''}`}
              onSuccess={() => {
                setIsPasswordOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInstructors;