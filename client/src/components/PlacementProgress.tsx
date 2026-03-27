import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type PlacementProgressProps = {
  gamesPlayed: number;
  totalMatches?: number;
  isPlacement: boolean;
};

const PlacementProgress = ({
  gamesPlayed,
  totalMatches = 10,
  isPlacement,
}: PlacementProgressProps) => {
  const safeTotal = Math.max(1, totalMatches);
  const safePlayed = Math.min(Math.max(0, gamesPlayed), safeTotal);
  const percent = Math.round((safePlayed / safeTotal) * 100);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">مرحلة تحديد المستوى</h3>
        {isPlacement ? (
          <Badge
            variant="secondary"
            title="التقييم يتغير بسرعة في هذه المرحلة"
            className="bg-amber-500/20 text-amber-300 border-amber-500/40"
          >
            لاعب جديد
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
            مستوى مثبت
          </Badge>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        مرحلة تحديد المستوى: {safePlayed} / {safeTotal} مباريات
      </div>

      <Progress value={percent} className="h-2.5 bg-muted" />
    </div>
  );
};

export default PlacementProgress;
