import type { Metadata } from "next";
import { TaskList } from "@/components/list/task-list";

export const metadata: Metadata = { title: "List" };

export default function ListPage() {
  return <TaskList />;
}
