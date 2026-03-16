"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Category {
  id: string;
  name: string;
}

interface ManageAccountCategoriesProps {
  type: 'income' | 'expenditure';
  onUpdate: () => void;
}

const ManageAccountCategories: React.FC<ManageAccountCategoriesProps> = ({ type, onUpdate }) => {
  const { user } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const tableName = type === 'income' ? 'income_categories' : 'expenditure_categories';

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      showError("Failed to load categories.");
    } else {
      setCategories(data || []);
    }
    setIsLoading(false);
  }, [user, tableName]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!user || !newCategory.trim()) return;
    const { error } = await supabase
      .from(tableName)
      .insert({ user_id: user.id, name: newCategory.trim() });

    if (error) showError("Failed to add category.");
    else {
      showSuccess("Category added!");
      setNewCategory("");
      fetchCategories();
      onUpdate();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    const { error } = await supabase
      .from(tableName)
      .update({ name: editingName.trim() })
      .eq("id", id);

    if (error) showError("Failed to update category.");
    else {
      showSuccess("Category updated!");
      setEditingId(null);
      fetchCategories();
      onUpdate();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", id);

    if (error) showError("Failed to delete category.");
    else {
      showSuccess("Category removed.");
      fetchCategories();
      onUpdate();
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          placeholder={`New ${type} category...`} 
          value={newCategory} 
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="icon" onClick={handleAdd} disabled={!newCategory.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
            {editingId === cat.id ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <Input 
                  value={editingName} 
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleUpdate(cat.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium">{cat.name}</span>
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8" 
                    onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-destructive hover:text-destructive" 
                    onClick={() => handleDelete(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageAccountCategories;