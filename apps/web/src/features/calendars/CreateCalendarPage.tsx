import UploadCalendarPanel from "./UploadCalendarPanel";

// Rule-based creation was removed at the product team's request (2026-11-06): calendars are now
// always created from an uploaded dates file. See PLANS.md for the removal notes.
export default function CreateCalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Create a calendar</h1>
      <UploadCalendarPanel />
    </div>
  );
}
