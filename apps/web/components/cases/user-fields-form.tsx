"use client";

import { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, CheckCircle2, User, X } from "lucide-react";
import { getCaseType, type FieldSchema } from "@/lib/firestore/case-types";
import { updateCaseUserFields } from "@/actions/cases";

interface UserFieldsFormProps {
  caseId: string;
  caseTypeId: string;
  initialValues?: Record<string, string | number | boolean>;
}

function buildZodSchema(userFields: Record<string, FieldSchema>) {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  Object.entries(userFields).forEach(([fieldId, fieldConfig]) => {
    let fieldSchema: z.ZodTypeAny = z.string();

    if (fieldConfig.schema.type === "string") {
      fieldSchema = z.string();

      if (fieldConfig.schema.format === "email") {
        fieldSchema = z.string().email("Invalid email address");
      } else if (fieldConfig.schema.pattern) {
        const pattern = new RegExp(fieldConfig.schema.pattern);
        if (fieldId === "zip_code") {
          fieldSchema = z.string().regex(pattern, "Invalid zip code (e.g., 12345 or 12345-6789)");
        } else if (fieldId === "phone_number") {
          fieldSchema = z.string().regex(pattern, "Invalid phone number");
        } else {
          fieldSchema = z.string().regex(pattern, "Invalid format");
        }
      }

      if (fieldConfig.schema.minLength && fieldConfig.schema.minLength > 0) {
        fieldSchema = (fieldSchema as z.ZodString).min(
          fieldConfig.schema.minLength,
          `Minimum ${fieldConfig.schema.minLength} character(s) required`
        );
      }
    } else if (fieldConfig.schema.type === "integer" || fieldConfig.schema.type === "number") {
      fieldSchema = z.number();
      if (fieldConfig.schema.minimum !== undefined) {
        fieldSchema = (fieldSchema as z.ZodNumber).min(
          fieldConfig.schema.minimum,
          `Minimum value is ${fieldConfig.schema.minimum}`
        );
      }
    }

    if (!fieldConfig.required) {
      fieldSchema = fieldSchema.optional().or(z.literal(""));
    }

    schemaFields[fieldId] = fieldSchema;
  });

  return z.object(schemaFields);
}

export function UserFieldsForm({ caseId, caseTypeId, initialValues = {} }: UserFieldsFormProps) {
  const [userFields, setUserFields] = useState<Record<string, FieldSchema> | null>(null);
  const [userFormConfig, setUserFormConfig] = useState<{
    heading?: string;
    subheading?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    async function loadCaseType() {
      try {
        const caseType = await getCaseType(caseTypeId);
        if (caseType && caseType.userFields) {
          setUserFields(caseType.userFields);
          setUserFormConfig(caseType.userForm || null);
        } else {
          setError("Case type configuration not found");
        }
      } catch (err) {
        console.error("Error loading case type:", err);
        setError("Failed to load form configuration");
      } finally {
        setLoading(false);
      }
    }

    loadCaseType();
  }, [caseTypeId]);

  const formSchema = userFields ? buildZodSchema(userFields) : z.object({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<Record<string, string | number | boolean>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0 && !initializedRef.current) {
      reset(initialValues);
      initializedRef.current = true;
    }
  }, [initialValues, reset]);

  const onSubmit = async (data: Record<string, string | number | boolean>) => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    const cleanedData: Record<string, string | number | boolean> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        cleanedData[key] = value;
      }
    });

    try {
      const result = await updateCaseUserFields(caseId, cleanedData);
      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setOpen(false);
        }, 1500);
      } else {
        setError(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Error saving user fields:", err);
      setError("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !userFields || Object.keys(userFields).length === 0) {
    return null;
  }

  const hasValues = initialValues && Object.keys(initialValues).length > 0;
  const fieldEntries = Object.entries(userFields).sort(([, a], [, b]) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasValues ? "outline" : "default"} className="w-full sm:w-auto">
          <User className="size-4" />
          {hasValues ? "Edit Your Information" : "Add Your Information"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{userFormConfig?.heading || "Your Information"}</DialogTitle>
          <DialogDescription>
            {userFormConfig?.subheading ||
              "Provide your contact information and relationship to the deceased for this case."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
              <X className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Information saved successfully</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldEntries.map(([fieldId, fieldConfig]) => {
              const cols = fieldConfig.cols ?? 1;
              const colSpanClass = cols === 2 ? "sm:col-span-2" : "";
              const hasOptions = fieldConfig.options && fieldConfig.options.length > 0;
              const fieldError = errors[fieldId as keyof typeof errors];

              return (
                <Field key={fieldId} className={colSpanClass}>
                  <FieldLabel htmlFor={fieldId}>
                    {fieldConfig.label}
                    {fieldConfig.required && <span className="text-destructive ml-1">*</span>}
                  </FieldLabel>
                  {hasOptions ? (
                    <Controller
                      name={fieldId}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value as string} onValueChange={field.onChange}>
                          <SelectTrigger id={fieldId} className="w-full">
                            <SelectValue
                              placeholder={
                                fieldConfig.placeholder ||
                                `Select ${fieldConfig.label.toLowerCase()}`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {fieldConfig.options?.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  ) : (
                    <Input
                      id={fieldId}
                      type={
                        fieldConfig.schema.format === "email"
                          ? "email"
                          : fieldId === "phone_number"
                            ? "tel"
                            : "text"
                      }
                      {...register(fieldId)}
                      placeholder={fieldConfig.placeholder || ""}
                    />
                  )}
                  {fieldError && <FieldError>{fieldError?.message as string}</FieldError>}
                </Field>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
