import { ReminderCenter } from "@/components/reminders/reminder-center";
import { PageHeader } from "@/components/shared/page-header";

export default function RemindersPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Neutral and configurable"
        title="Reminder center"
        description="Planning prompts and personal follow-ups without diagnosis details, shame, or alarmist language."
      />
      <ReminderCenter />
    </div>
  );
}
