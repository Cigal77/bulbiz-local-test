import { DesktopSidebar } from "@/components/DesktopSidebar";
import { OnboardingPrompt } from "@/components/OnboardingPrompt";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <DesktopSidebar />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      <OnboardingPrompt />
    </div>
  );
}
