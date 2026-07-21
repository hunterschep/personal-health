"use client";

import { Bell, CircleHelp, MoreHorizontal, Search, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert } from "@/components/ui/alert";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/feedback";
import {
  DateInput,
  EmailInput,
  ErrorSummary,
  FormField,
  PasswordInput,
  Select,
  Textarea,
  TextInput,
} from "@/components/ui/form";
import {
  CommandMenu,
  ConfirmationDialog,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlays";
import { Checkbox, Combobox, MultiSelect, RadioGroup } from "@/components/ui/selection";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const careOptions = [
  { value: "blood-pressure", label: "Blood pressure review", keywords: ["heart"] },
  { value: "colorectal", label: "Colorectal cancer screening", keywords: ["colon"] },
  { value: "influenza", label: "Seasonal influenza vaccine", keywords: ["flu"] },
] as const;

export function GalleryFormControls() {
  const [multiValues, setMultiValues] = useState<string[]>(["blood-pressure"]);
  return (
    <section aria-labelledby="gallery-forms" className="space-y-6">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">Input system</p>
        <h2 id="gallery-forms" className="font-editorial mt-1 text-3xl font-semibold">
          Form and selection controls
        </h2>
      </div>
      <ErrorSummary errors={["Choose a review date.", "Confirm the source of this record."]} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <FormField id="gallery-text" label="Text input" hint="A neutral supporting hint.">
          <TextInput id="gallery-text" placeholder="Routine care note" />
        </FormField>
        <FormField id="gallery-email" label="Email input">
          <EmailInput id="gallery-email" placeholder="name@example.com" autoComplete="email" />
        </FormField>
        <FormField id="gallery-password" label="Password input">
          <PasswordInput id="gallery-password" defaultValue="example-password" autoComplete="off" />
        </FormField>
        <FormField id="gallery-date" label="Date input" error="Choose a review date.">
          <DateInput id="gallery-date" />
        </FormField>
        <FormField id="gallery-select" label="Select">
          <Select id="gallery-select" defaultValue="routine">
            <option value="routine">Routine</option>
            <option value="clinician">Clinician managed</option>
          </Select>
        </FormField>
        <FormField id="gallery-textarea" label="Textarea">
          <Textarea id="gallery-textarea" placeholder="What would be useful at the next visit?" />
        </FormField>
        <Combobox label="Combobox" options={careOptions} placeholder="Find a service" />
        <MultiSelect
          label="Multi-select"
          options={careOptions}
          values={multiValues}
          onValuesChange={setMultiValues}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Checkbox
          label="Include in visit preparation"
          description="This controls the printout only."
          defaultChecked
        />
        <RadioGroup
          label="Record precision"
          defaultValue="month"
          options={[
            { value: "day", label: "Exact day" },
            { value: "month", label: "Month and year" },
            { value: "unknown", label: "Date unknown" },
          ]}
        />
        <div>
          <p className="text-sm font-semibold">Switch</p>
          <label
            htmlFor="gallery-switch"
            className="mt-3 flex min-h-11 items-center justify-between gap-3"
          >
            <span className="text-sm">Routine reminders</span>
            <Switch id="gallery-switch" defaultChecked aria-label="Routine reminders" />
          </label>
        </div>
      </div>
      <div className="max-w-xl">
        <ApproximateDateInput initialPrecision="year" initialValue="2024" />
      </div>
    </section>
  );
}

export function GalleryOverlays() {
  return (
    <section aria-labelledby="gallery-overlays" className="space-y-6">
      <div>
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
          Layered interaction
        </p>
        <h2 id="gallery-overlays" className="font-editorial mt-1 text-3xl font-semibold">
          Dialogs, menus, and feedback
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open modal dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review this plan detail</DialogTitle>
              <DialogDescription>
                Focus stays inside this dialog until it is closed, then returns to the trigger.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmationDialog
          trigger={<Button variant="secondary">Open confirmation</Button>}
          title="Remove this draft?"
          description="The saved care record remains unchanged. Only this unsaved draft is removed."
          confirmLabel="Remove draft"
          destructive
          onConfirm={() => toast.success("Draft removed")}
        />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="font-editorial pr-10 text-3xl font-semibold">
              Plan detail
            </SheetTitle>
            <SheetDescription className="text-ink-soft mt-2 text-sm leading-6">
              A side sheet keeps context visible on wider screens.
            </SheetDescription>
          </SheetContent>
        </Sheet>

        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="secondary">Open drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerTitle className="font-editorial pr-10 text-3xl font-semibold">
              Mobile detail
            </DrawerTitle>
            <DrawerDescription className="text-ink-soft mt-2 text-sm leading-6">
              The drawer uses the bottom edge and can become a full-screen detail surface.
            </DrawerDescription>
          </DrawerContent>
        </Drawer>

        <PopoverRoot>
          <PopoverTrigger asChild>
            <Button variant="secondary">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="font-semibold">Source note</p>
            <p className="text-ink-soft mt-1 text-sm leading-5">
              Popovers provide short, optional context without changing pages.
            </p>
          </PopoverContent>
        </PopoverRoot>

        <CommandMenu
          trigger={
            <Button variant="secondary">
              <Search aria-hidden="true" /> Open command menu
            </Button>
          }
          items={[
            {
              id: "records",
              label: "Add a care record",
              description: "Record a completed preventive service",
              shortcut: "R",
              onSelect: () => toast.success("Record action selected"),
            },
            {
              id: "reminders",
              label: "Review reminders",
              description: "Open upcoming reminder settings",
              shortcut: "M",
              onSelect: () => toast.success("Reminder action selected"),
            },
          ]}
        />

        <Button
          onClick={() =>
            toast.success("Care plan saved", {
              description: "No private details appear in this notification.",
            })
          }
        >
          Show toast
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton variant="secondary" aria-label="More component information">
                <MoreHorizontal aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>Tooltip with a keyboard-accessible trigger.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs defaultValue="summary">
        <TabsList aria-label="Gallery tabs">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <Alert tone="info" title="Tabs keep context close">
            Arrow keys move between tab triggers.
          </Alert>
        </TabsContent>
        <TabsContent value="details">
          <p className="text-ink-soft text-sm">Details remain keyboard reachable.</p>
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible className="border-line rounded-xl border px-4">
        <AccordionItem value="one">
          <AccordionTrigger>Why are exact dates optional?</AccordionTrigger>
          <AccordionContent>
            Approximate dates remain approximate so CareCadence never invents clinical history.
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <EmptyState
        icon={CircleHelp}
        title="Nothing needs attention here"
        description="Empty states explain what will appear without pressuring the person using the plan."
        actionLabel="Optional action"
        onAction={() => toast("Optional action selected")}
      />

      <div className="flex flex-wrap gap-2" aria-label="Button variants">
        <Button>
          <Sparkles aria-hidden="true" /> Primary
        </Button>
        <Button variant="secondary">
          <Settings2 aria-hidden="true" /> Secondary
        </Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="destructive">Destructive</Button>
        <IconButton variant="secondary" aria-label="Notification settings">
          <Bell aria-hidden="true" />
        </IconButton>
      </div>
    </section>
  );
}
