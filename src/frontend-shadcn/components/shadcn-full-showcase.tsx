"use client";

import {
  Bell,
  Blocks,
  BookOpen,
  ChartColumn,
  Command as CommandIcon,
  Layers,
  Menu,
  Monitor,
  PlayCircle,
  Search,
  Settings,
  Sparkles,
  TabletSmartphone,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/frontend-shadcn/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/frontend-shadcn/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/frontend-shadcn/ui/alert-dialog";
import { AspectRatio } from "@/frontend-shadcn/ui/aspect-ratio";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/frontend-shadcn/ui/avatar";
import { Badge } from "@/frontend-shadcn/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/frontend-shadcn/ui/breadcrumb";
import { Button, buttonVariants } from "@/frontend-shadcn/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/frontend-shadcn/ui/button-group";
import { Calendar } from "@/frontend-shadcn/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/frontend-shadcn/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/frontend-shadcn/ui/carousel";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/frontend-shadcn/ui/chart";
import { Checkbox } from "@/frontend-shadcn/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/frontend-shadcn/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/frontend-shadcn/ui/combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/frontend-shadcn/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/frontend-shadcn/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend-shadcn/ui/dialog";
import { DirectionProvider } from "@/frontend-shadcn/ui/direction";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/frontend-shadcn/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend-shadcn/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/frontend-shadcn/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/frontend-shadcn/ui/field";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/frontend-shadcn/ui/form";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/frontend-shadcn/ui/hover-card";
import { Input } from "@/frontend-shadcn/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/frontend-shadcn/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/frontend-shadcn/ui/input-otp";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/frontend-shadcn/ui/item";
import { Kbd } from "@/frontend-shadcn/ui/kbd";
import { Label } from "@/frontend-shadcn/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/frontend-shadcn/ui/menubar";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/frontend-shadcn/ui/native-select";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/frontend-shadcn/ui/navigation-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/frontend-shadcn/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend-shadcn/ui/popover";
import { Progress } from "@/frontend-shadcn/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/frontend-shadcn/ui/radio-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/frontend-shadcn/ui/resizable";
import { ScrollArea } from "@/frontend-shadcn/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend-shadcn/ui/select";
import { Separator } from "@/frontend-shadcn/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/frontend-shadcn/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/frontend-shadcn/ui/sidebar";
import { Skeleton } from "@/frontend-shadcn/ui/skeleton";
import { Slider } from "@/frontend-shadcn/ui/slider";
import { Toaster } from "@/frontend-shadcn/ui/sonner";
import { Spinner } from "@/frontend-shadcn/ui/spinner";
import { Switch } from "@/frontend-shadcn/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend-shadcn/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/frontend-shadcn/ui/tabs";
import { Textarea } from "@/frontend-shadcn/ui/textarea";
import { Toggle } from "@/frontend-shadcn/ui/toggle";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/frontend-shadcn/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/frontend-shadcn/ui/tooltip";
import { useIsMobile } from "@/frontend-shadcn/ui/use-mobile";
import { cn } from "@/lib/utils";

type ShowcaseSurface = "web" | "desktop";

type ShadcnFullShowcaseProps = {
  surface: ShowcaseSurface;
};

const COMPONENT_NAMES = [
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

const chartConfig = {
  active: {
    label: "Active",
    color: "var(--chart-1)",
  },
  idle: {
    label: "Idle",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const chartData = [
  { label: "Mon", active: 2200, idle: 1050 },
  { label: "Tue", active: 2430, idle: 970 },
  { label: "Wed", active: 2390, idle: 910 },
  { label: "Thu", active: 2710, idle: 830 },
  { label: "Fri", active: 2880, idle: 760 },
];

const frameworks = [
  { label: "Next.js", value: "nextjs" },
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
];

const regionOptions = ["global", "us", "eu", "apac"] as const;

function useSectionLinks(t: ReturnType<typeof useTranslation>["t"]) {
  return useMemo(
    () => [
      { href: "#overview", label: t("shadcnCloneDemo.nav.overview") },
      { href: "#forms", label: t("shadcnCloneDemo.nav.forms") },
      { href: "#overlays", label: t("shadcnCloneDemo.nav.overlays") },
      { href: "#data", label: t("shadcnCloneDemo.nav.data") },
      { href: "#registry", label: t("shadcnCloneDemo.nav.registry") },
    ],
    [t],
  );
}

export function ShadcnFullShowcase({ surface }: ShadcnFullShowcaseProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const links = useSectionLinks(t);

  const [profileRegion, setProfileRegion] =
    useState<(typeof regionOptions)[number]>("global");
  const [framework, setFramework] = useState("nextjs");
  const [otp, setOtp] = useState("");
  const [schedulerVolume, setSchedulerVolume] = useState([65]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );

  const form = useForm<{
    name: string;
    email: string;
    note: string;
  }>({
    defaultValues: {
      name: "Shadcn Showcase",
      email: "owner@buglogin.app",
      note: "",
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast.success(t("shadcnCloneDemo.toasts.saved"));
  });

  return (
    <DirectionProvider direction="ltr">
      <SidebarProvider
        className={cn(
          "bg-background",
          surface === "desktop"
            ? "h-[calc(100vh-var(--window-titlebar-height,0px))]"
            : "h-screen",
        )}
        style={
          {
            "--sidebar-width": "18rem",
          } as React.CSSProperties
        }
      >
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {t("shadcnCloneDemo.header.title")}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/70">
                  {t("shadcnCloneDemo.header.subtitle")}
                </p>
              </div>
            </div>
            <SidebarInput
              placeholder={t("shadcnCloneDemo.header.searchPlaceholder")}
            />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                {t("shadcnCloneDemo.nav.foundation")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <a href={item.href}>
                          <BookOpen className="h-4 w-4" />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>
                {t("shadcnCloneDemo.nav.system")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <TabletSmartphone className="h-4 w-4" />
                      <span>
                        {isMobile
                          ? t("shadcnCloneDemo.header.mobile")
                          : t("shadcnCloneDemo.header.desktop")}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Monitor className="h-4 w-4" />
                      <span>
                        {surface === "desktop"
                          ? "/app-shadcn-clone"
                          : "/shadcn-clone"}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarSeparator />
          <SidebarFooter>
            <div className="flex items-center justify-between rounded-md border border-sidebar-border p-2">
              <span className="text-xs text-sidebar-foreground/80">
                {t("shadcnCloneDemo.header.themeSync")}
              </span>
              <Switch defaultChecked />
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="@container/content min-h-0 overflow-hidden">
          <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-border bg-background/90 backdrop-blur">
            <div className="flex h-full items-center gap-3 px-4">
              <SidebarTrigger variant="outline" className="max-md:scale-125" />
              <Separator orientation="vertical" className="h-6" />
              <Breadcrumb className="hidden md:block">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {t("shadcnCloneDemo.breadcrumb.showcase")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <Badge variant="secondary">
                      {surface === "desktop"
                        ? t("shadcnCloneDemo.header.desktop")
                        : t("shadcnCloneDemo.header.web")}
                    </Badge>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <nav className="hidden items-center gap-1 md:flex">
                {links.map((item) => (
                  <Button key={item.href} variant="ghost" size="sm" asChild>
                    <a href={item.href}>{item.label}</a>
                  </Button>
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-2">
                <Input
                  className="hidden w-64 md:flex"
                  placeholder={t("shadcnCloneDemo.header.searchPlaceholder")}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline">
                      <Bell className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("shadcnCloneDemo.header.notifications")}
                  </TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="h-3.5 w-3.5" />
                      {t("shadcnCloneDemo.header.actions")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>
                      {t("shadcnCloneDemo.overlays.quickActions")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      {t("common.buttons.refresh")}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {t("common.buttons.export")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <ScrollArea
            className={cn(
              surface === "desktop"
                ? "h-[calc(100%-4rem)]"
                : "h-[calc(100svh-4rem)]",
            )}
          >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
              <section id="overview" className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("shadcnCloneDemo.sections.actions.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("shadcnCloneDemo.sections.actions.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button>{t("shadcnCloneDemo.actions.primary")}</Button>
                      <Button variant="secondary">
                        {t("shadcnCloneDemo.actions.secondary")}
                      </Button>
                      <Button variant="outline">
                        {t("shadcnCloneDemo.actions.outline")}
                      </Button>
                      <Button variant="ghost">
                        {t("shadcnCloneDemo.actions.ghost")}
                      </Button>
                      <Button variant="destructive">
                        {t("common.buttons.delete")}
                      </Button>
                    </div>

                    <ButtonGroup>
                      <Button variant="outline">
                        {t("shadcnCloneDemo.actions.left")}
                      </Button>
                      <ButtonGroupSeparator />
                      <Button variant="outline">
                        {t("shadcnCloneDemo.actions.center")}
                      </Button>
                      <ButtonGroupSeparator />
                      <Button variant="outline">
                        {t("shadcnCloneDemo.actions.right")}
                      </Button>
                    </ButtonGroup>

                    <InputGroup>
                      <InputGroupAddon>
                        <Search className="h-3.5 w-3.5" />
                        <InputGroupText>
                          {t("shadcnCloneDemo.actions.search")}
                        </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        placeholder={t(
                          "shadcnCloneDemo.actions.searchPlaceholder",
                        )}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton variant="ghost">
                          <CommandIcon className="h-3.5 w-3.5" />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>

                    <div className="flex flex-wrap items-center gap-2">
                      <Toggle aria-label={t("shadcnCloneDemo.actions.toggleA")}>
                        <Sparkles className="h-4 w-4" />
                      </Toggle>
                      <ToggleGroup type="multiple">
                        <ToggleGroupItem value="filters">
                          {t("shadcnCloneDemo.actions.filters")}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="rules">
                          {t("shadcnCloneDemo.actions.rules")}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="sync">
                          {t("shadcnCloneDemo.actions.sync")}
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <ButtonGroupText>
                        {t("shadcnCloneDemo.actions.toggleGroup")}
                      </ButtonGroupText>
                      <Kbd>{t("shadcnCloneDemo.actions.commandKey")}</Kbd>
                      <Spinner className="h-4 w-4" />
                    </div>

                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertTitle>
                        {t("shadcnCloneDemo.alert.title")}
                      </AlertTitle>
                      <AlertDescription>
                        {t("shadcnCloneDemo.alert.description")}
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          toast.success(
                            t("shadcnCloneDemo.toasts.toastPreview"),
                          )
                        }
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        {t("shadcnCloneDemo.toasts.previewButton")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("shadcnCloneDemo.sections.navigation.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("shadcnCloneDemo.sections.navigation.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <NavigationMenu>
                      <NavigationMenuList>
                        <NavigationMenuItem>
                          <NavigationMenuTrigger>
                            {t("shadcnCloneDemo.nav.forms")}
                          </NavigationMenuTrigger>
                          <NavigationMenuContent>
                            <div className="grid w-[260px] gap-1 p-3">
                              <NavigationMenuLink
                                className={buttonVariants({ variant: "ghost" })}
                                href="#forms"
                              >
                                {t("shadcnCloneDemo.nav.forms")}
                              </NavigationMenuLink>
                              <NavigationMenuLink
                                className={buttonVariants({ variant: "ghost" })}
                                href="#overlays"
                              >
                                {t("shadcnCloneDemo.nav.overlays")}
                              </NavigationMenuLink>
                            </div>
                          </NavigationMenuContent>
                        </NavigationMenuItem>
                        <NavigationMenuItem>
                          <NavigationMenuLink
                            className={buttonVariants({ variant: "ghost" })}
                            href="#registry"
                          >
                            {t("shadcnCloneDemo.nav.registry")}
                          </NavigationMenuLink>
                        </NavigationMenuItem>
                      </NavigationMenuList>
                    </NavigationMenu>

                    <Menubar>
                      <MenubarMenu>
                        <MenubarTrigger>
                          {t("shadcnCloneDemo.overlays.menuFile")}
                        </MenubarTrigger>
                        <MenubarContent>
                          <MenubarItem>
                            {t("common.buttons.save")}
                            <MenubarShortcut>⌘S</MenubarShortcut>
                          </MenubarItem>
                          <MenubarItem>
                            {t("common.buttons.export")}
                            <MenubarShortcut>⌘E</MenubarShortcut>
                          </MenubarItem>
                          <MenubarSeparator />
                          <MenubarItem>{t("common.buttons.close")}</MenubarItem>
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>

                    <Command className="rounded-md border border-border">
                      <CommandInput
                        placeholder={t(
                          "shadcnCloneDemo.mixed.commandPlaceholder",
                        )}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {t("shadcnCloneDemo.mixed.commandEmpty")}
                        </CommandEmpty>
                        <CommandGroup
                          heading={t("shadcnCloneDemo.mixed.commandHeading")}
                        >
                          <CommandItem>
                            <Layers className="h-4 w-4" />
                            {t("shadcnCloneDemo.mixed.commandItemA")}
                            <CommandShortcut>⌘1</CommandShortcut>
                          </CommandItem>
                          <CommandItem>
                            <Settings className="h-4 w-4" />
                            {t("shadcnCloneDemo.mixed.commandItemB")}
                            <CommandShortcut>⌘2</CommandShortcut>
                          </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup
                          heading={t("shadcnCloneDemo.mixed.commandHeadingB")}
                        >
                          <CommandItem>
                            <Bell className="h-4 w-4" />
                            {t("shadcnCloneDemo.mixed.commandItemC")}
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </CardContent>
                </Card>
              </section>

              <section id="forms">
                <Tabs defaultValue="forms" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="forms">
                      {t("shadcnCloneDemo.nav.forms")}
                    </TabsTrigger>
                    <TabsTrigger value="overlays">
                      {t("shadcnCloneDemo.nav.overlays")}
                    </TabsTrigger>
                    <TabsTrigger value="data">
                      {t("shadcnCloneDemo.nav.data")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="forms"
                    className="grid gap-4 lg:grid-cols-2"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.form.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("shadcnCloneDemo.sections.form.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Form {...form}>
                          <form className="space-y-4" onSubmit={onSubmit}>
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("shadcnCloneDemo.form.titleLabel")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t(
                                        "shadcnCloneDemo.form.titlePlaceholder",
                                      )}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    {t("shadcnCloneDemo.form.titleHelp")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("shadcnCloneDemo.form.emailLabel")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="owner@buglogin.app"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="note"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("shadcnCloneDemo.form.noteLabel")}
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder={t(
                                        "shadcnCloneDemo.form.notePlaceholder",
                                      )}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button type="submit">
                              {t("common.buttons.save")}
                            </Button>
                          </form>
                        </Form>

                        <Separator />

                        <FieldGroup>
                          <Field orientation="horizontal">
                            <FieldLabel>
                              {t("shadcnCloneDemo.form.syncLabel")}
                            </FieldLabel>
                            <FieldContent>
                              <Switch defaultChecked />
                              <FieldDescription>
                                {t("shadcnCloneDemo.form.syncHelp")}
                              </FieldDescription>
                            </FieldContent>
                          </Field>

                          <Field orientation="horizontal">
                            <FieldLabel>
                              {t("shadcnCloneDemo.form.regionLabel")}
                            </FieldLabel>
                            <FieldContent>
                              <Select
                                value={profileRegion}
                                onValueChange={(value) =>
                                  setProfileRegion(
                                    value as (typeof regionOptions)[number],
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "shadcnCloneDemo.form.modePlaceholder",
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {regionOptions.map((item) => (
                                    <SelectItem key={item} value={item}>
                                      {item.toUpperCase()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FieldContent>
                          </Field>

                          <Field orientation="horizontal">
                            <FieldLabel>
                              {t("shadcnCloneDemo.form.nativeLabel")}
                            </FieldLabel>
                            <FieldContent>
                              <NativeSelect
                                value={profileRegion}
                                onChange={(event) =>
                                  setProfileRegion(
                                    event.target
                                      .value as (typeof regionOptions)[number],
                                  )
                                }
                              >
                                {regionOptions.map((item) => (
                                  <NativeSelectOption key={item} value={item}>
                                    {item.toUpperCase()}
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                            </FieldContent>
                          </Field>
                        </FieldGroup>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.form.controlsTitle")}
                        </CardTitle>
                        <CardDescription>
                          {t(
                            "shadcnCloneDemo.sections.form.controlsDescription",
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2">
                          <Label>
                            {t("shadcnCloneDemo.form.comboboxLabel")}
                          </Label>
                          <Combobox
                            value={framework}
                            onValueChange={(value) =>
                              setFramework(String(value ?? ""))
                            }
                          >
                            <ComboboxInput
                              showClear
                              placeholder={t(
                                "shadcnCloneDemo.form.comboboxPlaceholder",
                              )}
                            />
                            <ComboboxContent>
                              <ComboboxList>
                                <ComboboxEmpty>
                                  {t("shadcnCloneDemo.form.comboboxEmpty")}
                                </ComboboxEmpty>
                                <ComboboxGroup>
                                  {frameworks.map((item) => (
                                    <ComboboxItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </ComboboxItem>
                                  ))}
                                </ComboboxGroup>
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>

                        <div className="grid gap-2">
                          <Label>{t("shadcnCloneDemo.form.otpLabel")}</Label>
                          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>

                        <div className="grid gap-2 rounded-md border border-border p-3">
                          <div className="flex items-center gap-2">
                            <Checkbox id="shadow-mode" defaultChecked />
                            <Label htmlFor="shadow-mode">
                              {t("shadcnCloneDemo.form.shadowLabel")}
                            </Label>
                          </div>

                          <RadioGroup
                            defaultValue="safe"
                            className="flex gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="safe" id="mode-safe" />
                              <Label htmlFor="mode-safe">
                                {t("shadcnCloneDemo.form.safe")}
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="fast" id="mode-fast" />
                              <Label htmlFor="mode-fast">
                                {t("shadcnCloneDemo.form.fast")}
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{t("shadcnCloneDemo.form.volume")}</span>
                            <span className="text-muted-foreground">
                              {schedulerVolume[0]}
                            </span>
                          </div>
                          <Slider
                            value={schedulerVolume}
                            onValueChange={setSchedulerVolume}
                            max={100}
                            step={1}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent
                    id="overlays"
                    value="overlays"
                    className="grid gap-4 lg:grid-cols-2"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.overlays.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("shadcnCloneDemo.sections.overlays.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.dialog")}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {t("shadcnCloneDemo.overlays.dialogTitle")}
                                </DialogTitle>
                                <DialogDescription>
                                  {t(
                                    "shadcnCloneDemo.overlays.dialogDescription",
                                  )}
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="secondary">
                                  {t("common.buttons.cancel")}
                                </Button>
                                <Button>{t("common.buttons.confirm")}</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.sheet")}
                              </Button>
                            </SheetTrigger>
                            <SheetContent>
                              <SheetHeader>
                                <SheetTitle>
                                  {t("shadcnCloneDemo.overlays.sheetTitle")}
                                </SheetTitle>
                                <SheetDescription>
                                  {t(
                                    "shadcnCloneDemo.overlays.sheetDescription",
                                  )}
                                </SheetDescription>
                              </SheetHeader>
                              <SheetFooter>
                                <Button>{t("common.buttons.refresh")}</Button>
                              </SheetFooter>
                            </SheetContent>
                          </Sheet>

                          <Drawer>
                            <DrawerTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.drawer")}
                              </Button>
                            </DrawerTrigger>
                            <DrawerContent>
                              <DrawerHeader>
                                <DrawerTitle>
                                  {t("shadcnCloneDemo.overlays.drawerTitle")}
                                </DrawerTitle>
                                <DrawerDescription>
                                  {t(
                                    "shadcnCloneDemo.overlays.drawerDescription",
                                  )}
                                </DrawerDescription>
                              </DrawerHeader>
                              <DrawerFooter>
                                <DrawerClose asChild>
                                  <Button variant="outline">
                                    {t("common.buttons.close")}
                                  </Button>
                                </DrawerClose>
                              </DrawerFooter>
                            </DrawerContent>
                          </Drawer>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive">
                                {t("shadcnCloneDemo.overlays.alertDialog")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("shadcnCloneDemo.overlays.alertTitle")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t(
                                    "shadcnCloneDemo.overlays.alertDescription",
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("common.buttons.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction>
                                  {t("common.buttons.confirm")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.popover")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="text-sm text-muted-foreground">
                              {t("shadcnCloneDemo.overlays.popoverBody")}
                            </PopoverContent>
                          </Popover>

                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.hoverCard")}
                              </Button>
                            </HoverCardTrigger>
                            <HoverCardContent>
                              {t("shadcnCloneDemo.overlays.hoverBody")}
                            </HoverCardContent>
                          </HoverCard>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline">
                                {t("shadcnCloneDemo.overlays.tooltip")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("shadcnCloneDemo.overlays.tooltipBody")}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <ContextMenu>
                          <ContextMenuTrigger className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                            {t("shadcnCloneDemo.overlays.contextHint")}
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem>
                              {t("common.buttons.copy")}
                            </ContextMenuItem>
                            <ContextMenuItem>
                              {t("common.buttons.rename")}
                            </ContextMenuItem>
                            <ContextMenuItem>
                              {t("common.buttons.delete")}
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.mixed.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("shadcnCloneDemo.sections.mixed.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AspectRatio ratio={16 / 6}>
                          <div className="flex h-full items-center justify-center rounded-md border border-border bg-muted/30">
                            <span className="text-sm text-muted-foreground">
                              {t("shadcnCloneDemo.mixed.aspectRatio")}
                            </span>
                          </div>
                        </AspectRatio>

                        <Carousel opts={{ loop: true }}>
                          <CarouselContent>
                            <CarouselItem>
                              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                                {t("shadcnCloneDemo.mixed.slideA")}
                              </div>
                            </CarouselItem>
                            <CarouselItem>
                              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                                {t("shadcnCloneDemo.mixed.slideB")}
                              </div>
                            </CarouselItem>
                            <CarouselItem>
                              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                                {t("shadcnCloneDemo.mixed.slideC")}
                              </div>
                            </CarouselItem>
                          </CarouselContent>
                          <CarouselPrevious />
                          <CarouselNext />
                        </Carousel>

                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent
                    id="data"
                    value="data"
                    className="grid gap-4 lg:grid-cols-2"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.data.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("shadcnCloneDemo.sections.data.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {t("shadcnCloneDemo.data.table.component")}
                              </TableHead>
                              <TableHead>
                                {t("shadcnCloneDemo.data.table.status")}
                              </TableHead>
                              <TableHead className="text-right">
                                {t("shadcnCloneDemo.data.table.version")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>sidebar</TableCell>
                              <TableCell>
                                {t("shadcnCloneDemo.data.ready")}
                              </TableCell>
                              <TableCell className="text-right">v1</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>combobox</TableCell>
                              <TableCell>
                                {t("shadcnCloneDemo.data.ready")}
                              </TableCell>
                              <TableCell className="text-right">v1</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>native-select</TableCell>
                              <TableCell>
                                {t("shadcnCloneDemo.data.ready")}
                              </TableCell>
                              <TableCell className="text-right">v1</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>

                        <Accordion type="single" collapsible>
                          <AccordionItem value="why">
                            <AccordionTrigger>
                              {t("shadcnCloneDemo.data.accordion.itemA")}
                            </AccordionTrigger>
                            <AccordionContent>
                              {t("shadcnCloneDemo.data.accordion.bodyA")}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="how">
                            <AccordionTrigger>
                              {t("shadcnCloneDemo.data.accordion.itemB")}
                            </AccordionTrigger>
                            <AccordionContent>
                              {t("shadcnCloneDemo.data.accordion.bodyB")}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>

                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="outline">
                              {t("shadcnCloneDemo.data.collapseTrigger")}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 pt-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                            <Skeleton className="h-4 w-2/3" />
                          </CollapsibleContent>
                        </Collapsible>

                        <ItemGroup>
                          <Item variant="outline">
                            <ItemMedia variant="icon">
                              <Blocks className="h-4 w-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemHeader>
                                <ItemTitle>
                                  {t("shadcnCloneDemo.data.items.titleA")}
                                </ItemTitle>
                              </ItemHeader>
                              <ItemDescription>
                                {t("shadcnCloneDemo.data.items.bodyA")}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <Badge variant="secondary">
                                {t("shadcnCloneDemo.data.ready")}
                              </Badge>
                            </ItemActions>
                          </Item>
                          <ItemSeparator />
                          <Item variant="outline">
                            <ItemMedia variant="icon">
                              <ChartColumn className="h-4 w-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>
                                {t("shadcnCloneDemo.data.items.titleB")}
                              </ItemTitle>
                              <ItemDescription>
                                {t("shadcnCloneDemo.data.items.bodyB")}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        </ItemGroup>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("shadcnCloneDemo.sections.metrics.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("shadcnCloneDemo.sections.metrics.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ChartContainer
                          config={chartConfig}
                          className="max-h-[240px] w-full"
                        >
                          <AreaChart data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                            />
                            <ChartTooltip
                              content={(props) => (
                                <ChartTooltipContent {...(props as any)} />
                              )}
                            />
                            <ChartLegend
                              content={(props) => (
                                <ChartLegendContent {...(props as any)} />
                              )}
                            />
                            <Area
                              dataKey="active"
                              type="natural"
                              fill="var(--color-active)"
                              fillOpacity={0.35}
                              stroke="var(--color-active)"
                            />
                            <Area
                              dataKey="idle"
                              type="natural"
                              fill="var(--color-idle)"
                              fillOpacity={0.3}
                              stroke="var(--color-idle)"
                            />
                          </AreaChart>
                        </ChartContainer>

                        <ResizablePanelGroup
                          orientation="horizontal"
                          className="min-h-32 rounded-md border border-border"
                        >
                          <ResizablePanel defaultSize={35}>
                            <div className="flex h-full items-center justify-center p-3 text-xs text-muted-foreground">
                              {t("shadcnCloneDemo.metrics.leftPane")}
                            </div>
                          </ResizablePanel>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={65}>
                            <div className="flex h-full items-center justify-center p-3 text-xs text-muted-foreground">
                              {t("shadcnCloneDemo.metrics.rightPane")}
                            </div>
                          </ResizablePanel>
                        </ResizablePanelGroup>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{t("shadcnCloneDemo.data.progress")}</span>
                            <span className="text-muted-foreground">74%</span>
                          </div>
                          <Progress value={74} />
                        </div>

                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious href="#registry" />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink href="#registry" isActive>
                                1
                              </PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink href="#registry">
                                2
                              </PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationNext href="#registry" />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>

                        <Empty className="min-h-[120px] rounded-md border border-dashed border-border">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Layers className="h-5 w-5" />
                            </EmptyMedia>
                            <EmptyTitle>
                              {t("shadcnCloneDemo.metrics.emptyTitle")}
                            </EmptyTitle>
                            <EmptyDescription>
                              {t("shadcnCloneDemo.metrics.emptyDescription")}
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <Button size="sm">
                              {t("shadcnCloneDemo.metrics.emptyAction")}
                            </Button>
                          </EmptyContent>
                        </Empty>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </section>

              <section id="registry">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("shadcnCloneDemo.sections.registry.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("shadcnCloneDemo.sections.registry.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-56 rounded-md border border-border">
                      <div className="grid gap-1 p-3 md:grid-cols-3">
                        {COMPONENT_NAMES.map((name) => (
                          <div
                            key={name}
                            className="rounded-sm border border-border px-2 py-1.5 text-sm"
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    {t("shadcnCloneDemo.sections.registry.footer", {
                      value: COMPONENT_NAMES.length,
                    })}
                  </CardFooter>
                </Card>
              </section>
            </div>
          </ScrollArea>
        </SidebarInset>

        <Toaster position="top-right" />
      </SidebarProvider>
    </DirectionProvider>
  );
}
