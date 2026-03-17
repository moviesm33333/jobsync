"use client";
import { useState } from "react";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { Button } from "../ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { JobLocation } from "@/models/job.model";
import { MoreHorizontal, Trash } from "lucide-react";
import { AlertDialog } from "@/models/alertDialog.model";
import { toast } from "../ui/use-toast";
import { deleteJobLocationById } from "@/actions/jobLocation.actions";

type JobLocationsTableProps = {
  jobLocations: JobLocation[];
  reloadJobLocations: () => void;
};

function JobLocationsTable({
  jobLocations,
  reloadJobLocations,
}: JobLocationsTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });
  const onDeleteJobLocation = (location: JobLocation) => {
    if (location._count?.jobsApplied! > 0) {
      setAlert({
        openState: true,
        title: "Есть связанные отклики!",
        description:
          "Количество связанных откликов должно быть 0, чтобы удалить этот город",
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: location.id,
      });
    }
  };
  const deleteJobLocation = async (locationId: string) => {
    if (locationId) {
      const { success, message } = await deleteJobLocationById(locationId);
      if (success) {
        toast({
          variant: "success",
          description: `Город успешно удалён`,
        });
        reloadJobLocations();
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка!",
          description: message,
        });
      }
    }
  };
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Город</TableHead>
            <TableHead className="hidden sm:table-cell">Значение</TableHead>
            <TableHead>Откликов</TableHead>
            <TableHead>Действия</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobLocations.map((location: JobLocation) => {
            return (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.label}</TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {location.value}
                </TableCell>
                <TableCell className="font-medium">
                  {location._count?.jobsApplied}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Действия</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteJobLocation(location)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="location"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteJobLocation(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default JobLocationsTable;
