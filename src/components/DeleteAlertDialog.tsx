import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { buttonVariants } from "./ui/button";

interface DeleteAlertDialogProps {
  pageTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  alertTitle?: string;
  alertDescription?: string;
  deleteAction?: boolean;
}

export function DeleteAlertDialog({
  pageTitle,
  open,
  onOpenChange,
  onDelete,
  alertTitle,
  alertDescription = "Это действие нельзя отменить. Данные будут безвозвратно удалены.",
  deleteAction = true,
}: DeleteAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {alertTitle ?? `Вы уверены, что хотите удалить?`}
          </AlertDialogTitle>
          <AlertDialogDescription>{alertDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          {deleteAction && (
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={onDelete}
            >
              Удалить
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
