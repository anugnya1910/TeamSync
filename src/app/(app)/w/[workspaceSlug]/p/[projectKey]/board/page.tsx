import type { Metadata } from "next";
import { Board } from "@/components/board/board";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return <Board />;
}
