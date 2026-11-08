import type { Metadata } from "next";
import { MonthCalendar } from "@/components/calendar/month-calendar";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return <MonthCalendar />;
}
