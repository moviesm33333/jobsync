import {
  LayoutDashboard,
  SquareCheckBig,
  BriefcaseBusiness,
  CalendarClock,
  UserRound,
  Sheet,
  Wrench,
  Zap,
  BookOpen,
} from "lucide-react";

export const APP_CONSTANTS = {
  RECORDS_PER_PAGE: 25,
  RECORDS_PER_PAGE_OPTIONS: [25, 50, 100],
  ACTIVITY_MAX_DURATION_MINUTES: 8 * 60, // 8 Hours
  ACTIVITY_MAX_DURATION_MS: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  RECENT_NUM_JOBS_ACTIVITIES: 7,
} as const;

export const SCHEDULER_CONSTANTS = {
  ENABLED: true,
  CRON_EXPRESSION: "0 * * * *", // Every hour at minute 0
} as const;

export const JOB_SOURCES = [
  { label: "Indeed", value: "indeed" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Monster", value: "monster" },
  { label: "Glassdoor", value: "glassdoor" },
  { label: "Сайт компании", value: "careerpage" },
  { label: "Google", value: "google" },
  { label: "ZipRecruiter", value: "ziprecruiter" },
  { label: "Job Street", value: "jobstreet" },
  { label: "Другое", value: "other" },
] as const;

export const JOB_STATUSES = [
  { label: "Черновик", value: "draft" },
  { label: "Отклик", value: "applied" },
  { label: "Собеседование", value: "interview" },
  { label: "Оффер", value: "offer" },
  { label: "Отказ", value: "rejected" },
  { label: "Истекла", value: "expired" },
  { label: "Архив", value: "archived" },
] as const;

export const SIDEBAR_LINKS = [
  {
    icon: LayoutDashboard,
    route: "/dashboard",
    label: "Главная",
  },
  {
    icon: BriefcaseBusiness,
    route: "/dashboard/myjobs",
    label: "Мои вакансии",
  },
  {
    icon: Zap,
    route: "/dashboard/automations",
    label: "Автоматизация",
  },
  {
    icon: SquareCheckBig,
    route: "/dashboard/tasks",
    label: "Задачи",
  },
  {
    icon: CalendarClock,
    route: "/dashboard/activities",
    label: "Активность",
  },
  {
    icon: BookOpen,
    route: "/dashboard/questions",
    label: "База вопросов",
  },
  {
    icon: UserRound,
    route: "/dashboard/profile",
    label: "Профиль",
  },
  {
    icon: Sheet,
    route: "/dashboard/admin",
    label: "Управление",
  },
  {
    icon: Wrench,
    route: "/dashboard/developer",
    label: "Для разработчика",
    devOnly: true,
  },
];
