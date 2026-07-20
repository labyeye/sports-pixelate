import { Trophy } from "lucide-react";
import type { Event } from "@/types/hrms";

interface Props {
  event: Event;
  onGoToSettings: () => void;
}

// Read-only summary — editing goes through Settings/EventForm to avoid
// duplicating the awards form logic in two places.
export function AwardsTab({ event, onGoToSettings }: Props) {
  const a = event.awards;
  const hasAny =
    a &&
    (a.winnerPrize ||
      a.runnerUpPrize ||
      a.cashPrize ||
      a.medals ||
      a.trophies ||
      a.specialAwards?.length ||
      a.description);

  return (
    <div className="space-y-4">
      {!hasAny ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No awards configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set winner/runner-up prizes and more from Settings.
          </p>
        </div>
      ) : (
        <div className="border-2 border-black bg-white p-4 space-y-2">
          {a?.winnerPrize && (
            <div className="flex justify-between border-2 border-black/10 px-3 py-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Winner Prize
              </span>
              <span className="text-sm font-bold">{a.winnerPrize}</span>
            </div>
          )}
          {a?.runnerUpPrize && (
            <div className="flex justify-between border-2 border-black/10 px-3 py-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Runner-up Prize
              </span>
              <span className="text-sm font-bold">{a.runnerUpPrize}</span>
            </div>
          )}
          {typeof a?.cashPrize === "number" && a.cashPrize > 0 && (
            <div className="flex justify-between border-2 border-black/10 px-3 py-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Cash Prize
              </span>
              <span className="text-sm font-bold">₹{a.cashPrize}</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {a?.medals && (
              <span className="border-2 border-black px-2 py-1 text-xs font-bold">
                Medals
              </span>
            )}
            {a?.trophies && (
              <span className="border-2 border-black px-2 py-1 text-xs font-bold">
                Trophies
              </span>
            )}
            {a?.participationCertificate && (
              <span className="border-2 border-black px-2 py-1 text-xs font-bold">
                Participation Certificate
              </span>
            )}
          </div>
          {a?.specialAwards && a.specialAwards.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {a.specialAwards.map((s) => (
                <span
                  key={s}
                  className="border-2 border-black px-2 py-1 text-xs font-bold bg-[#FBBF24]/10"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {a?.description && (
            <p className="text-sm text-muted-foreground pt-2">
              {a.description}
            </p>
          )}
        </div>
      )}
      <button
        onClick={onGoToSettings}
        className="text-xs font-bold text-[#024BAB] underline"
      >
        Edit in Settings →
      </button>
    </div>
  );
}
