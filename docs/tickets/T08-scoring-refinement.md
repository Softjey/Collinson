# T08 Scoring refinement (optional)

| | |
|---|---|
| Depends on | T05 |
| Unblocks | none |
| Wave | any time after T05, parallel with T06 |

## Goal

Address the known limits of the scoring, if time remains. Scoring refinement was deliberately postponed to the
end of the work. If this ticket is not done, that is stated in the README with the reason.

References: [technical spec](../technical-spec.md) sections 8 and 9 (limitations).

## Candidates

| Limit | Where it shows |
|---|---|
| Skiing in the off-season is not always unscored | high grid cells keep snow, so the day is scored rather than `NO_SNOW` |
| Surfing ignores wind direction | Uluwatu wet-season months score as high as dry ones |
| The two outdoor caps and the snow depth multiplier were derived from the events they were checked on | no independent set of storm days; with humidex the caps rest on Storm Eunice alone |

## Rules for this ticket

- Each change is proposed to the owner with options first, and recorded in DECISIONS.md only after it is
  confirmed.
- Tests first: the case that shows the limit is added as a failing fixture, then the change makes it pass
  without breaking the existing fixtures of T02.
- Changes stay inside `src/scoring` (parameters in `scoring.params.ts`). No data migration is needed, because
  scores are derived at read time.
- A change that needs new upstream variables also changes the request, the schema and `parserVersion`, and is
  therefore out of scope unless the owner asks for it.

## Done when

- Each attempted limit is either fixed with a passing fixture, or noted as not fixed with one line on why.
