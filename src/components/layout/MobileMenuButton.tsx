"use client";

import React from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

interface MobileMenuButtonProps {
  logoUrl: string | null;
}

const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({ logoUrl }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[240px]">
        <Sidebar isCollapsed={false} logoUrl={logoUrl} onLinkClick={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenuButton;