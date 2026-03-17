import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { AddSummarySectionFormSchema } from "@/models/addSummaryForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Loader } from "lucide-react";
import { useEffect, useTransition } from "react";
import { toast } from "../ui/use-toast";
import { z } from "zod";
import TiptapEditor from "../TiptapEditor";
import {
  addResumeSummary,
  updateResumeSummary,
} from "@/actions/profile.actions";
import { ResumeSection } from "@/models/profile.model";

interface AddResumeSummaryProps {
  resumeId: string | undefined;
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
  summaryToEdit?: ResumeSection | null;
}

function AddResumeSummary({
  resumeId,
  dialogOpen,
  setDialogOpen,
  summaryToEdit,
}: AddResumeSummaryProps) {
  const [isPending, startTransition] = useTransition();

  const pageTitle = summaryToEdit ? "Редактировать раздел «О себе»" : "Добавить раздел «О себе»";

  const form = useForm<z.infer<typeof AddSummarySectionFormSchema>>({
    resolver: zodResolver(AddSummarySectionFormSchema),
    defaultValues: {
      resumeId,
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (summaryToEdit) {
      reset(
        {
          id: summaryToEdit.id,
          sectionTitle: summaryToEdit.sectionTitle,
          sectionType: summaryToEdit.sectionType,
          content: summaryToEdit.summary?.content!,
        },
        {
          keepDefaultValues: true,
        }
      );
    }
  }, [summaryToEdit, reset]);

  const onSubmit = (data: z.infer<typeof AddSummarySectionFormSchema>) => {
    startTransition(async () => {
      const res = summaryToEdit
        ? await updateResumeSummary(data)
        : await addResumeSummary(data);
      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Ошибка!",
          description: res.message,
        });
      } else {
        reset();
        setDialogOpen(false);
        toast({
          variant: "success",
          description: `Раздел «О себе» успешно ${
            summaryToEdit ? "обновлён" : "создан"
          }`,
        });
      }
    });
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="lg:max-h-screen overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
          >
            {/* SECTION TITLE */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="sectionTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название раздела</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Напр.: О себе" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* SUMMARY CONTENT */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>О себе</FormLabel>
                    <FormControl>
                      <TiptapEditor field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="md:col-span-2 mt-4">
              <DialogFooter
              // className="md:col-span
              >
                <div>
                  <Button
                    type="reset"
                    variant="outline"
                    className="mt-2 md:mt-0 w-full"
                    onClick={closeDialog}
                  >
                    Отмена
                  </Button>
                </div>
                <Button type="submit" disabled={!formState.isDirty}>
                  Сохранить
                  {isPending && <Loader className="h-4 w-4 shrink-0 spinner" />}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddResumeSummary;
