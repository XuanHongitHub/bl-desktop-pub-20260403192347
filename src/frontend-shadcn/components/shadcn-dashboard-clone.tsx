"use client";

import {
  Bell,
  Circle,
  Copy,
  FileText,
  Folder,
  Gauge,
  Github,
  LineChart,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import shadcnUrlManifest from "@/frontend-shadcn/data/shadcn-url-manifest.json";
import { Badge } from "@/frontend-shadcn/ui/badge";
import { Button } from "@/frontend-shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/frontend-shadcn/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/frontend-shadcn/ui/chart";
import { Checkbox } from "@/frontend-shadcn/ui/checkbox";
import { DirectionProvider } from "@/frontend-shadcn/ui/direction";
import { Input } from "@/frontend-shadcn/ui/input";
import { Label } from "@/frontend-shadcn/ui/label";
import { ScrollArea } from "@/frontend-shadcn/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend-shadcn/ui/select";
import { Separator } from "@/frontend-shadcn/ui/separator";
import { Switch } from "@/frontend-shadcn/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend-shadcn/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/frontend-shadcn/ui/tabs";
import { cn } from "@/lib/utils";

type CloneSurface = "web" | "desktop";
type MainSection =
  | "docs"
  | "components"
  | "blocks"
  | "charts"
  | "directory"
  | "create";
type ExampleSection =
  | "dashboard"
  | "tasks"
  | "playground"
  | "authentication"
  | "rtl";

type ShadcnDashboardCloneProps = {
  surface: CloneSurface;
};

const componentNames = [
  "accordion",
  "alert",
  "alert-dialog",
  "aspect-ratio",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "calendar",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "dialog",
  "direction",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "form",
  "hover-card",
  "input",
  "input-group",
  "input-otp",
  "item",
  "kbd",
  "label",
  "menubar",
  "native-select",
  "navigation-menu",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "resizable",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "sonner",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toggle",
  "toggle-group",
  "tooltip",
  "use-mobile",
] as const;

const mainNav: MainSection[] = [
  "docs",
  "components",
  "blocks",
  "charts",
  "directory",
  "create",
];

const visitorChartConfig = {
  visitors: {
    label: "Visitors",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const barChartConfig = {
  done: {
    label: "Done",
    color: "var(--chart-2)",
  },
  pending: {
    label: "Pending",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const visitorChartData = [
  { month: "Jan", visitors: 420 },
  { month: "Feb", visitors: 360 },
  { month: "Mar", visitors: 510 },
  { month: "Apr", visitors: 620 },
  { month: "May", visitors: 500 },
  { month: "Jun", visitors: 430 },
  { month: "Jul", visitors: 560 },
];

const taskChartData = [
  { week: "W1", done: 22, pending: 9 },
  { week: "W2", done: 28, pending: 11 },
  { week: "W3", done: 19, pending: 7 },
  { week: "W4", done: 30, pending: 10 },
];

const stats = [
  {
    key: "revenue",
    value: "$1,250.00",
    trend: "+12.5%",
  },
  {
    key: "customers",
    value: "1,234",
    trend: "-20%",
  },
  {
    key: "accounts",
    value: "45,678",
    trend: "+12.5%",
  },
  {
    key: "growth",
    value: "4.5%",
    trend: "+4.5%",
  },
] as const;

const sidebarTopKeys = [
  "dashboard",
  "lifecycle",
  "analytics",
  "projects",
  "team",
] as const;
const sidebarBottomKeys = [
  "dataLibrary",
  "reports",
  "wordAssistant",
  "more",
] as const;

const fakeTasks = [
  { name: "Sync design tokens", status: "Done", priority: "High" },
  { name: "Export icons", status: "Pending", priority: "Medium" },
  { name: "Review spacing scale", status: "In review", priority: "Low" },
  { name: "Run visual diff", status: "Done", priority: "High" },
];

function SidebarMenuPanel({
  t,
}: {
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <aside className="border-r border-border bg-muted/20 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 py-1">
        <Circle className="h-3.5 w-3.5 fill-foreground text-foreground" />
        <span className="text-lg font-semibold">
          {t("shadcnCloneSkill.sidebar.orgName")}
        </span>
      </div>

      <div className="space-y-1 px-2 py-2">
        <p className="text-xs text-muted-foreground">
          {t("shadcnCloneSkill.sidebar.home")}
        </p>
        {sidebarTopKeys.map((key) => (
          <div
            key={key}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            {key === "dashboard" ? <Gauge className="h-4 w-4" /> : null}
            {key === "lifecycle" ? <LineChart className="h-4 w-4" /> : null}
            {key === "analytics" ? <Bell className="h-4 w-4" /> : null}
            {key === "projects" ? <Folder className="h-4 w-4" /> : null}
            {key === "team" ? <Users className="h-4 w-4" /> : null}
            <span>{t(`shadcnCloneSkill.sidebar.top.${key}`)}</span>
          </div>
        ))}
      </div>

      <Separator className="my-2" />

      <div className="space-y-1 px-2 py-2">
        <p className="text-xs text-muted-foreground">
          {t("shadcnCloneSkill.sidebar.documents")}
        </p>
        {sidebarBottomKeys.map((key) => (
          <div
            key={key}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            {key === "more" ? (
              <MoreHorizontal className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>{t(`shadcnCloneSkill.sidebar.bottom.${key}`)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DashboardPanel({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("shadcnCloneSkill.content.title")}
        </h1>
        <Button size="sm">
          <Circle className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
          {t("shadcnCloneSkill.content.quickCreate")}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.key}>
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>
                  {t(`shadcnCloneSkill.stats.${item.key}.title`)}
                </CardDescription>
                <Badge variant="secondary">{item.trend}</Badge>
              </div>
              <CardTitle className="text-4xl tracking-tight">
                {item.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              <p className="text-sm font-medium">
                {t(`shadcnCloneSkill.stats.${item.key}.description`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`shadcnCloneSkill.stats.${item.key}.subDescription`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("shadcnCloneSkill.chart.title")}</CardTitle>
            <CardDescription>
              {t("shadcnCloneSkill.chart.description")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm">
              {t("shadcnCloneSkill.chart.range.3m")}
            </Button>
            <Button variant="ghost" size="sm">
              {t("shadcnCloneSkill.chart.range.30d")}
            </Button>
            <Button variant="ghost" size="sm">
              {t("shadcnCloneSkill.chart.range.7d")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={visitorChartConfig}
            className="h-[280px] w-full"
          >
            <AreaChart
              data={visitorChartData}
              margin={{ left: 8, right: 8, top: 12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={(props) => (
                  <ChartTooltipContent {...(props as any)} hideLabel />
                )}
              />
              <Area
                dataKey="visitors"
                type="natural"
                fill="var(--color-visitors)"
                fillOpacity={0.28}
                stroke="var(--color-visitors)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </main>
  );
}

function TasksPanel({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("shadcnCloneSkill.pages.tasks.title")}
        </h1>
        <Button size="sm">{t("shadcnCloneSkill.pages.tasks.action")}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("shadcnCloneSkill.pages.tasks.tableTitle")}</CardTitle>
          <CardDescription>
            {t("shadcnCloneSkill.pages.tasks.tableDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("shadcnCloneSkill.pages.tasks.columns.task")}
                </TableHead>
                <TableHead>
                  {t("shadcnCloneSkill.pages.tasks.columns.status")}
                </TableHead>
                <TableHead>
                  {t("shadcnCloneSkill.pages.tasks.columns.priority")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fakeTasks.map((task) => (
                <TableRow key={task.name}>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>{task.status}</TableCell>
                  <TableCell>{task.priority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("shadcnCloneSkill.pages.tasks.chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[260px] w-full">
            <BarChart data={taskChartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                content={(props) => <ChartTooltipContent {...(props as any)} />}
              />
              <Bar dataKey="done" fill="var(--color-done)" radius={6} />
              <Bar dataKey="pending" fill="var(--color-pending)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </main>
  );
}

function PlaygroundPanel({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {t("shadcnCloneSkill.pages.playground.title")}
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("shadcnCloneSkill.pages.playground.controls")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="clone-search">
                {t("shadcnCloneSkill.pages.playground.searchLabel")}
              </Label>
              <Input
                id="clone-search"
                placeholder={t(
                  "shadcnCloneSkill.pages.playground.searchPlaceholder",
                )}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span>{t("shadcnCloneSkill.pages.playground.liveSync")}</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border p-3">
              <Checkbox id="clone-check" defaultChecked />
              <Label htmlFor="clone-check">
                {t("shadcnCloneSkill.pages.playground.includeAssets")}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("shadcnCloneSkill.pages.playground.preview")}
            </CardTitle>
            <CardDescription>
              {t("shadcnCloneSkill.pages.playground.previewDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {componentNames.slice(0, 9).map((name) => (
              <div
                key={name}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                {name}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function AuthenticationPanel({
  t,
}: {
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <main className="grid gap-4 p-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            {t("shadcnCloneSkill.pages.authentication.signInTitle")}
          </CardTitle>
          <CardDescription>
            {t("shadcnCloneSkill.pages.authentication.signInDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="signin-email">
              {t("shadcnCloneSkill.pages.authentication.email")}
            </Label>
            <Input id="signin-email" placeholder="name@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signin-password">
              {t("shadcnCloneSkill.pages.authentication.password")}
            </Label>
            <Input
              id="signin-password"
              type="password"
              placeholder="********"
            />
          </div>
          <Button className="w-full">
            {t("shadcnCloneSkill.pages.authentication.signInButton")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("shadcnCloneSkill.pages.authentication.signUpTitle")}
          </CardTitle>
          <CardDescription>
            {t("shadcnCloneSkill.pages.authentication.signUpDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="signup-name">
              {t("shadcnCloneSkill.pages.authentication.name")}
            </Label>
            <Input
              id="signup-name"
              placeholder={t(
                "shadcnCloneSkill.pages.authentication.namePlaceholder",
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signup-email">
              {t("shadcnCloneSkill.pages.authentication.email")}
            </Label>
            <Input id="signup-email" placeholder="name@example.com" />
          </div>
          <Button variant="secondary" className="w-full">
            {t("shadcnCloneSkill.pages.authentication.signUpButton")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function RtlPanel({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <div dir="rtl">
      <main className="space-y-4 p-4">
        <h1 className="text-2xl font-semibold">
          {t("shadcnCloneSkill.pages.rtl.title")}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>{t("shadcnCloneSkill.pages.rtl.cardTitle")}</CardTitle>
            <CardDescription>
              {t("shadcnCloneSkill.pages.rtl.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("shadcnCloneSkill.pages.rtl.body")}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ComponentsSection({
  t,
}: {
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("shadcnCloneSkill.components.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("shadcnCloneSkill.components.description")}
          </p>
        </div>
        <Badge variant="secondary">{componentNames.length}</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {componentNames.map((name) => (
          <div
            key={name}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            {name}
          </div>
        ))}
      </div>
    </main>
  );
}

function ChartsSection({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {t("shadcnCloneSkill.charts.title")}
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("shadcnCloneSkill.charts.visitors")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={visitorChartConfig}
              className="h-[260px] w-full"
            >
              <AreaChart data={visitorChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={(props) => (
                    <ChartTooltipContent {...(props as any)} />
                  )}
                />
                <Area
                  dataKey="visitors"
                  type="natural"
                  fill="var(--color-visitors)"
                  fillOpacity={0.25}
                  stroke="var(--color-visitors)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("shadcnCloneSkill.charts.tasks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={barChartConfig}
              className="h-[260px] w-full"
            >
              <BarChart data={taskChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={28} />
                <ChartTooltip
                  content={(props) => (
                    <ChartTooltipContent {...(props as any)} />
                  )}
                />
                <Bar dataKey="done" fill="var(--color-done)" radius={6} />
                <Bar dataKey="pending" fill="var(--color-pending)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function DirectorySection({
  t,
}: {
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const urls = shadcnUrlManifest.urls as string[];
  const grouped = shadcnUrlManifest.grouped as Record<string, string[]>;
  const rows = useMemo(
    () =>
      urls.map((url, index) => ({
        index: index + 1,
        url,
        category:
          Object.entries(grouped).find(([, list]) => list.includes(url))?.[0] ??
          "other",
      })),
    [],
  );

  const groupedCounts = useMemo(
    () =>
      Object.entries(grouped).map(([key, list]) => ({
        key,
        count: list.length,
      })),
    [],
  );

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {t("shadcnCloneSkill.directory.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("shadcnCloneSkill.directory.description", { value: rows.length })}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {groupedCounts.map((item) => (
          <Card key={item.key}>
            <CardHeader className="pb-2">
              <CardDescription>{item.key}</CardDescription>
              <CardTitle className="text-2xl">{item.count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>
                  {t("shadcnCloneSkill.directory.category")}
                </TableHead>
                <TableHead>{t("shadcnCloneSkill.directory.url")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.url}>
                  <TableCell>{row.index}</TableCell>
                  <TableCell className="uppercase">{row.category}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.url}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function CreateSection({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {t("shadcnCloneSkill.create.title")}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("shadcnCloneSkill.create.cardTitle")}</CardTitle>
          <CardDescription>
            {t("shadcnCloneSkill.create.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input placeholder={t("shadcnCloneSkill.create.projectName")} />
          <Input placeholder={t("shadcnCloneSkill.create.targetUrl")} />
          <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span>{t("shadcnCloneSkill.create.includeAssets")}</span>
            <Switch defaultChecked />
          </div>
          <Button>{t("shadcnCloneSkill.create.button")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function DocsSection({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {t("shadcnCloneSkill.docs.title")}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("shadcnCloneSkill.docs.cardTitle")}</CardTitle>
          <CardDescription>
            {t("shadcnCloneSkill.docs.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("shadcnCloneSkill.docs.bulletA")}</p>
          <p>{t("shadcnCloneSkill.docs.bulletB")}</p>
          <p>{t("shadcnCloneSkill.docs.bulletC")}</p>
        </CardContent>
      </Card>
    </main>
  );
}

export function ShadcnDashboardClone({ surface }: ShadcnDashboardCloneProps) {
  const { t } = useTranslation();
  const [activeMain, setActiveMain] = useState<MainSection>("blocks");
  const [activeExample, setActiveExample] =
    useState<ExampleSection>("dashboard");

  return (
    <DirectionProvider direction="ltr">
      <div
        className={cn(
          "flex flex-col bg-background text-foreground",
          surface === "desktop"
            ? "h-[calc(100vh-var(--window-titlebar-height,0px))]"
            : "min-h-screen",
        )}
      >
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-4 px-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4" />
              <nav className="hidden items-center gap-1 md:flex">
                {mainNav.map((key) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-sm font-medium",
                      activeMain === key ? "bg-accent" : "",
                    )}
                    onClick={() => setActiveMain(key)}
                  >
                    {t(`shadcnCloneSkill.header.mainNav.${key}`)}
                  </Button>
                ))}
              </nav>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden w-[300px] md:block">
                <Input
                  placeholder={t("shadcnCloneSkill.header.searchPlaceholder")}
                />
              </div>
              <Button variant="ghost" size="icon" aria-label="github">
                <Github className="h-4 w-4" />
              </Button>
              <Badge variant="secondary">111k</Badge>
              <Button variant="default" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t("shadcnCloneSkill.header.new")}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-3">
          {activeMain === "blocks" ? (
            <Tabs
              value={activeExample}
              onValueChange={(v) => setActiveExample(v as ExampleSection)}
            >
              <TabsList className="h-10">
                <TabsTrigger value="dashboard">
                  {t("shadcnCloneSkill.header.subNav.dashboard")}
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  {t("shadcnCloneSkill.header.subNav.tasks")}
                </TabsTrigger>
                <TabsTrigger value="playground">
                  {t("shadcnCloneSkill.header.subNav.playground")}
                </TabsTrigger>
                <TabsTrigger value="authentication">
                  {t("shadcnCloneSkill.header.subNav.authentication")}
                </TabsTrigger>
                <TabsTrigger value="rtl">
                  {t("shadcnCloneSkill.header.subNav.rtl")}
                  <Circle className="ml-1 h-2 w-2 fill-primary text-primary" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("shadcnCloneSkill.header.sectionHint")}
            </p>
          )}

          <div className="hidden items-center gap-2 md:flex">
            <Select defaultValue="neutral">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">
                  {t("shadcnCloneSkill.header.neutral")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="copy">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 px-4 pb-4">
          {activeMain === "blocks" ? (
            <div className="grid min-h-0 w-full grid-cols-1 overflow-hidden rounded-xl border border-border md:grid-cols-[240px_1fr]">
              <SidebarMenuPanel t={t} />
              <ScrollArea className="min-h-0">
                {activeExample === "dashboard" ? (
                  <DashboardPanel t={t} />
                ) : null}
                {activeExample === "tasks" ? <TasksPanel t={t} /> : null}
                {activeExample === "playground" ? (
                  <PlaygroundPanel t={t} />
                ) : null}
                {activeExample === "authentication" ? (
                  <AuthenticationPanel t={t} />
                ) : null}
                {activeExample === "rtl" ? <RtlPanel t={t} /> : null}
              </ScrollArea>
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-xl border border-border">
              <ScrollArea className="h-full min-h-0">
                {activeMain === "docs" ? <DocsSection t={t} /> : null}
                {activeMain === "components" ? (
                  <ComponentsSection t={t} />
                ) : null}
                {activeMain === "charts" ? <ChartsSection t={t} /> : null}
                {activeMain === "directory" ? <DirectorySection t={t} /> : null}
                {activeMain === "create" ? <CreateSection t={t} /> : null}
              </ScrollArea>
            </div>
          )}
        </div>

        <footer className="border-t border-border py-2">
          <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 px-4 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span>{t("shadcnCloneSkill.footer.source")}</span>
          </div>
        </footer>
      </div>
    </DirectionProvider>
  );
}
