import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ASSET_COLUMNS, ColumnDef } from '@/types';
import { Settings2 } from 'lucide-react';

interface Props {
  visibleColumns: string[];
  onChange: (columns: string[]) => void;
}

const GROUP_LABELS: Record<string, string> = {
  basic: 'Basic Fields',
  details: 'Asset Details',
  depreciation: 'Depreciation',
  wfh: 'WFH Details',
};

export default function ColumnSelector({ visibleColumns, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (key: string) => {
    if (visibleColumns.includes(key)) {
      onChange(visibleColumns.filter((c) => c !== key));
    } else {
      onChange([...visibleColumns, key]);
    }
  };

  const resetDefaults = () => {
    onChange(ASSET_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  };

  const groups = ['basic', 'details', 'depreciation', 'wfh'] as const;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-xs text-muted-foreground">({visibleColumns.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-3 py-2.5 flex items-center justify-between">
          <p className="text-sm font-medium">Select Columns</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-accent" onClick={resetDefaults}>
            Reset
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-72">
          <div className="p-2 space-y-3">
            {groups.map((group) => {
              const cols = ASSET_COLUMNS.filter((c) => c.group === group);
              if (cols.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-1 mb-1.5">
                    {GROUP_LABELS[group]}
                  </p>
                  <div className="space-y-1">
                    {cols.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={visibleColumns.includes(col.key)}
                          onCheckedChange={() => toggle(col.key)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
