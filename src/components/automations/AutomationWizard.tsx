"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CreateAutomationSchema, type CreateAutomationInput } from "@/models/automation.schema";
import { createAutomation, updateAutomation } from "@/actions/automation.actions";
import { toast } from "@/components/ui/use-toast";
import type { AutomationWithResume } from "@/models/automation.model";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Resume {
  id: string;
  title: string;
}

interface AutomationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumes: Resume[];
  onSuccess: () => void;
  editAutomation?: AutomationWithResume | null;
}

const STEPS = [
  { id: "basics", title: "Основное", description: "Назовите автоматизацию" },
  { id: "search", title: "Поиск", description: "Настройте критерии поиска" },
  { id: "resume", title: "Резюме", description: "Выберите резюме для сопоставления" },
  { id: "matching", title: "Совпадение", description: "Установите порог совпадения" },
  { id: "schedule", title: "Расписание", description: "Когда запускать" },
  { id: "review", title: "Обзор", description: "Подтвердите настройки" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export function AutomationWizard({
  open,
  onOpenChange,
  resumes,
  onSuccess,
  editAutomation,
}: AutomationWizardProps) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateAutomationInput>({
    resolver: zodResolver(CreateAutomationSchema),
    mode: "onChange",
    defaultValues: {
      name: editAutomation?.name ?? "",
      jobBoard: (editAutomation?.jobBoard as CreateAutomationInput["jobBoard"]) ?? "jsearch",
      keywords: editAutomation?.keywords ?? "",
      location: editAutomation?.location ?? "",
      resumeId: editAutomation?.resumeId ?? "",
      matchThreshold: editAutomation?.matchThreshold ?? 80,
      scheduleHour: editAutomation?.scheduleHour ?? 8,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editAutomation?.name ?? "",
        jobBoard: (editAutomation?.jobBoard as CreateAutomationInput["jobBoard"]) ?? "jsearch",
        keywords: editAutomation?.keywords ?? "",
        location: editAutomation?.location ?? "",
        resumeId: editAutomation?.resumeId ?? "",
        matchThreshold: editAutomation?.matchThreshold ?? 80,
        scheduleHour: editAutomation?.scheduleHour ?? 8,
      });
      setStep(0);
    }
  }, [open, editAutomation, form]);

  const formValues = form.watch();

  const onSubmit = async (data: CreateAutomationInput) => {
    setIsSubmitting(true);
    try {
      const result = editAutomation
        ? await updateAutomation(editAutomation.id, data)
        : await createAutomation(data);

      if (result.success) {
        toast({
          title: editAutomation ? "Автоматизация обновлена" : "Автоматизация создана",
          description: editAutomation
            ? "Ваша автоматизация успешно обновлена."
            : "Ваша автоматизация создана и будет запущена в запланированное время.",
        });
        form.reset();
        setStep(0);
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: "Ошибка!",
          description: result.message || "Что-то пошло не так",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка!",
        description: "Не удалось сохранить автоматизацию",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    switch (step) {
      case 0:
        return (formValues.name?.trim().length ?? 0) > 0;
      case 1:
        return (
          (formValues.keywords?.trim().length ?? 0) > 0 &&
          (formValues.location?.trim().length ?? 0) > 0
        );
      case 2:
        return (formValues.resumeId?.length ?? 0) > 0;
      case 3:
      case 4:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleClose = () => {
    form.reset();
    setStep(0);
    onOpenChange(false);
  };

  const selectedResume = resumes.find((r) => r.id === formValues.resumeId);

  const renderStepContent = () => {
    return (
      <>
        {/* Step 0: Basics */}
        <div className={step === 0 ? "space-y-4" : "hidden"}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название автоматизации</FormLabel>
                <FormControl>
                  <Input placeholder="напр., Вакансии Full Stack в Москве" {...field} />
                </FormControl>
                <FormDescription>
                  Описательное название для идентификации этой автоматизации
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobBoard"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Площадка</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите площадку" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="jsearch">JSearch (Google Jobs)</SelectItem>
                    <SelectItem value="headhunter">HeadHunter (hh.ru)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Площадка для поиска (скоро будет больше)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Step 1: Search */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <FormField
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ключевые слова для поиска</FormLabel>
                <FormControl>
                  <Input placeholder="напр., Full Stack Developer" {...field} />
                </FormControl>
                <FormDescription>
                  Названия должностей, навыки или ключевые слова для поиска
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Местоположение</FormLabel>
                <FormControl>
                  <Input placeholder="напр., Москва" {...field} />
                </FormControl>
                <FormDescription>
                  Город, область или регион для поиска
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Step 2: Resume */}
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <FormField
            control={form.control}
            name="resumeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Резюме для сопоставления</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите резюме" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {resumes.map((resume) => (
                      <SelectItem key={resume.id} value={resume.id}>
                        {resume.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Вакансии будут сопоставляться с этим резюме
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {resumes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Резюме не найдены. Сначала создайте резюме в профиле.
            </p>
          )}
        </div>

        {/* Step 3: Matching */}
        <div className={step === 3 ? "space-y-4" : "hidden"}>
          <FormField
            control={form.control}
            name="matchThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Порог совпадения: {field.value}%
                </FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
                <FormDescription>
                  Сохранять только вакансии с совпадением выше этого процента.
                  Выше = меньше, но лучше совпадения.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Step 4: Schedule */}
        <div className={step === 4 ? "space-y-4" : "hidden"}>
          <FormField
            control={form.control}
            name="scheduleHour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Время ежедневного запуска</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(parseInt(val))}
                  value={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите время" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value.toString()}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Автоматизация будет запускаться ежедневно в это время (часовой пояс сервера)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Step 5: Review */}
        <div className={step === 5 ? "space-y-4" : "hidden"}>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Название</span>
              <span className="font-medium">{formValues.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Площадка</span>
              <span className="font-medium capitalize">{formValues.jobBoard || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ключевые слова</span>
              <span className="font-medium">{formValues.keywords || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Местоположение</span>
              <span className="font-medium">{formValues.location || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Резюме</span>
              <span className="font-medium">{selectedResume?.title || "Не выбрано"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Порог совпадения</span>
              <span className="font-medium">{formValues.matchThreshold ?? 80}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Расписание</span>
              <span className="font-medium">
                Ежедневно в {(formValues.scheduleHour ?? 8).toString().padStart(2, "0")}:00
              </span>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editAutomation ? "Редактировать автоматизацию" : "Создать автоматизацию"}
          </DialogTitle>
          <DialogDescription>
            Шаг {step + 1} из {STEPS.length}: {STEPS[step].description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            const firstError = Object.values(errors)[0];
            if (firstError?.message) {
              toast({
                title: "Ошибка валидации",
                description: firstError.message as string,
                variant: "destructive",
              });
            }
          })}>
            <div className="py-4">{renderStepContent()}</div>

            <DialogFooter className="gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Назад
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep} disabled={!canGoNext()}>
                  Далее
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editAutomation ? "Обновить" : "Создать"} автоматизацию
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
