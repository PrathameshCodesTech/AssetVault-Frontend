import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  onClick: () => void;
}

export default function ChartDownloadBtn({ onClick }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Download as Excel</TooltipContent>
    </Tooltip>
  );
}
