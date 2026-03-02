"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCaseName } from "@/actions/cases";
import { useToast } from "@/hooks/use-toast";

interface EditableCaseNameProps {
  caseId: string;
  initialName: string;
}

export function EditableCaseName({ caseId, initialName }: EditableCaseNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (name.trim() === initialName) {
      setIsEditing(false);
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Case name cannot be empty",
        variant: "destructive",
      });
      setName(initialName);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    const result = await updateCaseName(caseId, name);

    setIsSaving(false);

    if (result.success) {
      setIsEditing(false);
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update case name",
        variant: "destructive",
      });
      setName(initialName);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setName(initialName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="text-2xl font-bold h-auto py-1 px-2 w-auto min-w-[200px]"
          maxLength={100}
          style={{ width: `${Math.max(200, name.length * 16)}px` }}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 w-8 shrink-0"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl font-bold">{name}</h1>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
