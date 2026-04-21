import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BulbizLogo } from "@/components/BulbizLogo";

interface LegalPageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <BulbizLogo />
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </header>
      <main className="p-4 sm:p-6 md:p-10 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-foreground/90
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground
          [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80
          [&_p]:leading-relaxed
        ">
          {children}
        </div>
      </main>
    </div>
  );
}
