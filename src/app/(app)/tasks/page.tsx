import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheckIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TASK_VIEWS, type TaskView } from "@/features/tasks/constants";
import { TaskRow } from "@/features/tasks/components/task-row";
import { getTaskCounts, listTasks } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Seguimientos" };

type SearchParams = PageProps<"/tasks">["searchParams"];
type Counts = Awaited<ReturnType<typeof getTaskCounts>>;

const EMPTY_COPY: Record<TaskView, string> = {
  today: "No tienes seguimientos para hoy.",
  overdue: "¡Nada vencido! Vas al día.",
  upcoming: "No hay seguimientos programados para los próximos días.",
  completed: "Aún no has completado seguimientos.",
  cancelled: "No hay seguimientos cancelados.",
};

async function resolveView(searchParams: SearchParams): Promise<TaskView> {
  const sp = await searchParams;
  return typeof sp.view === "string" && sp.view in TASK_VIEWS ? (sp.view as TaskView) : "today";
}

function TabLinks({ view, counts }: { view: TaskView | null; counts: Counts | null }) {
  return (
    <nav aria-label="Filtrar seguimientos" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
        {(Object.entries(TASK_VIEWS) as [TaskView, string][]).map(([key, label]) => {
          const count = counts && key in counts ? counts[key as keyof Counts] : null;
          const active = key === view;
          return (
            <li key={key}>
              <Link
                href={key === "today" ? "/tasks" : `/tasks?view=${key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                  active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {count ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs",
                      key === "overdue" ? "bg-destructive text-white" : "bg-muted-foreground/15",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function TaskTabs({ searchParams }: { searchParams: SearchParams }) {
  const [view, counts] = await Promise.all([resolveView(searchParams), getTaskCounts()]);
  return <TabLinks view={view} counts={counts} />;
}

async function TaskList({ searchParams }: { searchParams: SearchParams }) {
  const view = await resolveView(searchParams);
  const { tasks, timezone } = await listTasks(view);
  if (tasks.length === 0) return <EmptyState icon={CalendarCheckIcon} title={EMPTY_COPY[view]} />;
  const now = new Date();
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} timezone={timezone} now={now} />
      ))}
    </ul>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando seguimientos">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Seguimientos" description="Completa, pospón o cancela tus próximas acciones." />
      <Suspense fallback={<TabLinks view={null} counts={null} />}>
        <TaskTabs searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
