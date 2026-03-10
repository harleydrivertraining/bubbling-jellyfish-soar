"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
}

interface StudentSearchProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  students: Student[];
  isLoading?: boolean;
  placeholder?: string;
}

const StudentSearch: React.FC<StudentSearchProps> = ({
  value,
  onChange,
  students,
  isLoading,
  placeholder = "Select student",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === value),
    [students, value]
  );

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (studentId: string) => {
    onChange(studentId);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-normal h-10 px-3",
            !value && "text-muted-foreground"
          )}
          onClick={() => setIsOpen(true)}
          disabled={isLoading}
        >
          <span className="truncate">
            {selectedStudent ? selectedStudent.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      ) : (
        <div className="flex items-center border rounded-md px-3 bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 h-10">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-full w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
                setSearchTerm("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSearchTerm("");
            }}
            className="ml-2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[250px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {filteredStudents.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
              No students found.
            </div>
          ) : (
            <div className="py-1">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={cn(
                    "flex items-center w-full px-4 py-3 text-sm text-left hover:bg-accent transition-colors border-b last:border-0",
                    student.id === value && "bg-accent/50 font-bold"
                  )}
                  onClick={() => handleSelect(student.id)}
                >
                  <Check
                    className={cn(
                      "mr-3 h-4 w-4 text-primary",
                      student.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{student.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentSearch;