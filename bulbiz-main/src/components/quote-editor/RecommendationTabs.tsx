import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecommendationItem {
  id: string;
  label: string;
  description?: string;
  unit: string;
  default_qty: number;
  unit_price: number;
  vat_rate: number;
  weight: number;
  type?: string;
  group_label?: string;
}

interface RecommendationTabsProps {
  items: RecommendationItem[];
  onAdd: (item: RecommendationItem) => void;
}

export function RecommendationTabs({ items, onAdd }: RecommendationTabsProps) {
  const essential = items.filter((i) => i.weight >= 100);
  const frequent = items.filter((i) => i.weight >= 60 && i.weight < 100);
  const options = items.filter((i) => i.weight < 60);

  const renderList = (list: RecommendationItem[]) => {
    if (list.length === 0) return <p className="text-xs text-muted-foreground py-3 text-center">Aucun élément</p>;

    // Group by group_label if available
    const grouped = new Map<string, RecommendationItem[]>();
    list.forEach((item) => {
      const group = item.group_label || "Général";
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(item);
    });

    return (
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([group, groupItems]) => (
          <div key={group}>
            {grouped.size > 1 && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group}</p>
            )}
            {groupItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                  <div className="flex gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{item.default_qty} {item.unit}</Badge>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{item.unit_price}€</Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" onClick={() => onAdd(item)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Tabs defaultValue="essential" className="w-full">
      <TabsList className="w-full grid grid-cols-3 h-8">
        <TabsTrigger value="essential" className="text-xs">
          Indispensable {essential.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{essential.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="frequent" className="text-xs">
          Fréquent {frequent.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{frequent.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="options" className="text-xs">
          Options {options.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{options.length}</Badge>}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="essential" className="mt-2">{renderList(essential)}</TabsContent>
      <TabsContent value="frequent" className="mt-2">{renderList(frequent)}</TabsContent>
      <TabsContent value="options" className="mt-2">{renderList(options)}</TabsContent>
    </Tabs>
  );
}
