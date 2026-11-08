import { AppProviders } from "../providers";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
