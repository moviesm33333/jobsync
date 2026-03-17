import { Metadata } from "next";
import {
  MockActivitiesCard,
  MockProfileCard,
} from "@/components/developer/DeveloperContainer";

export const metadata: Metadata = {
  title: "Для разработчика | JobSync",
  description: "Инструменты для разработки и тестирования",
};

export default function DeveloperPage() {
  return (
    <>
      <div className="col-span-3">
        <h1 className="text-3xl font-bold tracking-tight">Для разработчика</h1>
        <p className="text-muted-foreground mt-2">
          Инструменты для разработки и тестирования. Доступно только в режиме разработки.
        </p>
      </div>
      <div className="col-start-1 self-start">
        <MockActivitiesCard />
      </div>
      <div className="col-start-2 self-start">
        <MockProfileCard />
      </div>
    </>
  );
}
