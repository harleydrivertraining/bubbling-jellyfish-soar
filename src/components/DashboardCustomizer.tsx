"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Eye, EyeOff, GripVertical } from "lucide-react";

export interface DashboardWidget {
  id: string;
  label: string;
  visible: boolean;
}

interface DashboardCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: DashboardWidget[];
  onUpdateWidgets: (widgets: DashboardWidget[]) => void;
  onReset: () => void;
}

const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
  isOpen,
  onClose,
  widgets,
  onUpdateWidgets,
  onReset,
}) => {
  const moveWidget = (index: number, direction: "up" | "down") => {
    const newWidgets = [...widgets];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newWidgets.length) {
      [newWidgets[index], newWidgets[targetIndex]] = [
        newWidgets[targetIndex],
        newWidgets[index],
      ];
      onUpdateWidgets(newWidgets);
    }
  };

  const toggleVisibility = (id: string) => {
    const newWidgets = widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    onUpdateWidgets(newWidgets);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customise Dashboard</DialogTitle>
          <DialogDescription>
            Rearrange or hide sections of your dashboard to suit your workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => moveWidget(index, "up")}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === widgets.length - 1}
                    onClick={() => moveWidget(index, "down")}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Label className="font-medium">{widget.label}</Label>
              </div>
              <div className="flex items-center gap-2">
                {widget.visible ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-destructive" />
                )}
                <Switch
                  checked={widget.visible}
                  onCheckedChange={() => toggleVisibility(widget.id)}
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={onReset}>
            Reset to Default
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardCustomizer;