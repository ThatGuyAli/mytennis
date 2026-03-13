"use client";

import { Fragment } from "react";

import { APP_COLORS } from "@/lib/theme-colors";
import type { League, MatchStatus } from "@/types";

type MatchRow = {
  id: string;
  league_id: string;
  league_name?: string;
  player1_name: string;
  player2_name: string;
  week_number: number;
  played_at: string | null;
  status: MatchStatus;
};

type SetRow = {
  match_id: string;
  set_number: number;
  player1_games: number;
  player2_games: number;
  is_tiebreak: boolean;
};

type InlineSetFormRow = {
  set_number: number;
  player1_games: string;
  player2_games: string;
};

type MatchesOverviewLeague = Pick<League, "id" | "name" | "rule_type" | "first_round_weeks">;

type MatchesOverviewSectionProps = {
  title?: string;
  matchesByLeague: Array<{ league: MatchesOverviewLeague; matches: MatchRow[] }>;
  selectedWeekByLeague: Record<string, number>;
  onChangeLeagueWeek: (leagueId: string, week: number) => void;
  getDefaultWeekForLeague: (
    league: MatchesOverviewLeague,
    matches: Array<{ week_number: number; played_at: string | null }>,
  ) => number;
  setsByMatch: Map<string, SetRow[]>;
  editingResultMatchId: string;
  editingResultRuleType: League["rule_type"];
  inlineSetRows: InlineSetFormRow[];
  inlineResultIsDns: boolean;
  inlineResultIsDnf: boolean;
  busy: boolean;
  isTieBreakThirdSetActive: (rows: InlineSetFormRow[]) => boolean;
  updateInlineSetRow: (
    setNumber: number,
    side: "player1_games" | "player2_games",
    value: string,
  ) => void;
  setInlineResultIsDnf: (value: boolean) => void;
  setInlineResultIsDns: (value: boolean) => void;
  onSaveInlineResult: (matchId: string) => Promise<void>;
  onCancelInlineResultEdit: () => void;
  onStartInlineResultEdit: (
    matchId: string,
    leagueId: string,
    matchSets: SetRow[],
    matchStatus?: string,
  ) => void;
  readOnly?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not played yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function MatchesOverviewSection({
  title = "Matches Overview",
  matchesByLeague,
  selectedWeekByLeague,
  onChangeLeagueWeek,
  getDefaultWeekForLeague,
  setsByMatch,
  editingResultMatchId,
  editingResultRuleType,
  inlineSetRows,
  inlineResultIsDns,
  inlineResultIsDnf,
  busy,
  isTieBreakThirdSetActive,
  updateInlineSetRow,
  setInlineResultIsDnf,
  setInlineResultIsDns,
  onSaveInlineResult,
  onCancelInlineResultEdit,
  onStartInlineResultEdit,
  readOnly = false,
}: MatchesOverviewSectionProps) {
  return (
    <section
      className="rounded-2xl border p-4 shadow-xl"
      style={{
        backgroundColor: APP_COLORS.login.panelBackground,
        borderColor: APP_COLORS.login.panelBorder,
        boxShadow: `0 24px 56px ${APP_COLORS.login.panelShadow}`,
      }}
    >
      <h2 className="text-lg font-semibold" style={{ color: APP_COLORS.login.title }}>
        {title}
      </h2>
      <div className="mt-3 space-y-4">
        {matchesByLeague.map(({ league, matches }) => {
          const selectedWeek =
            selectedWeekByLeague[league.id] ?? getDefaultWeekForLeague(league, matches);
          const weekOptions = Array.from({ length: league.first_round_weeks }, (_, i) => i + 1);
          const filteredMatches = matches.filter((m) => m.week_number === selectedWeek);

          return (
            <div
              key={league.id}
              className="rounded-xl border p-3"
              style={{ borderColor: APP_COLORS.login.panelBorder, backgroundColor: "#ffffffcc" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: APP_COLORS.login.title }}>
                  {league.name}
                </h3>
                <select
                  value={selectedWeek}
                  onChange={(e) => onChangeLeagueWeek(league.id, Number(e.target.value))}
                  className="rounded-lg border bg-white px-2 py-1 text-sm"
                  style={{ borderColor: APP_COLORS.login.panelBorder }}
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>

              {filteredMatches.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: APP_COLORS.login.subtitle }}>
                  {matches.length === 0 ? "No matches yet." : `No matches for week ${selectedWeek}.`}
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="px-1 py-1.5 text-left sm:px-3 sm:py-2" rowSpan={2}>
                          Match
                        </th>
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2" colSpan={3}>
                          Result
                        </th>
                        {!readOnly ? (
                          <th className="px-1 py-1.5 text-right sm:px-3 sm:py-2" rowSpan={2}>
                            Action
                          </th>
                        ) : null}
                      </tr>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="border-r border-zinc-200 px-1 py-1.5 text-center sm:px-3 sm:py-2 dark:border-zinc-700">
                          Set 1
                        </th>
                        <th className="border-r border-zinc-200 px-1 py-1.5 text-center sm:px-3 sm:py-2 dark:border-zinc-700">
                          Set 2
                        </th>
                        <th className="px-1 py-1.5 text-center sm:px-3 sm:py-2">
                          {league.rule_type === "two_sets_tiebreak" ? "Tie-br" : "Set 3"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatches.map((match) => {
                        const matchSets = setsByMatch.get(match.id) ?? [];
                        const setScores = [1, 2, 3].map((setNumber) => {
                          const set = matchSets.find((item) => item.set_number === setNumber);
                          return set ? `${set.player1_games}-${set.player2_games}` : "-";
                        });
                        const isEditingRow = editingResultMatchId === match.id;
                        const tieBreakEnabled =
                          editingResultRuleType === "two_sets_tiebreak"
                            ? isTieBreakThirdSetActive(inlineSetRows)
                            : false;

                        return (
                          <Fragment key={match.id}>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800">
                              <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                                <div>{match.player1_name}</div>
                                <div>{match.player2_name}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatDate(match.played_at)}
                                </div>
                                {isEditingRow && inlineResultIsDns ? (
                                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                    Enter 6-0 6-0 for the player who showed up
                                  </div>
                                ) : null}
                              </td>
                              {[1, 2, 3].map((setNumber, index) => {
                                const editingSet = inlineSetRows.find(
                                  (row) => row.set_number === setNumber,
                                );
                                const isThirdSetTieBreak =
                                  editingResultRuleType === "two_sets_tiebreak" && setNumber === 3;
                                const isDisabled =
                                  isEditingRow && isThirdSetTieBreak && !tieBreakEnabled;

                                return (
                                  <td
                                    key={`${match.id}-set-${index}`}
                                    className={`px-2 py-1.5 text-center sm:px-3 sm:py-2 ${index < 2 ? "border-r border-zinc-200 dark:border-zinc-700" : ""}`}
                                  >
                                    {isEditingRow && !readOnly ? (
                                      <div className="flex flex-col items-center justify-center gap-1 sm:flex-row">
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={editingSet?.player1_games ?? "0"}
                                          onChange={(event) =>
                                            updateInlineSetRow(
                                              setNumber,
                                              "player1_games",
                                              event.target.value,
                                            )
                                          }
                                          disabled={isDisabled}
                                          className="w-10 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={editingSet?.player2_games ?? "0"}
                                          onChange={(event) =>
                                            updateInlineSetRow(
                                              setNumber,
                                              "player2_games",
                                              event.target.value,
                                            )
                                          }
                                          disabled={isDisabled}
                                          className="w-10 rounded border border-zinc-300 bg-white px-1 py-0.5 text-center text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                                        />
                                      </div>
                                    ) : (
                                      setScores[index]
                                    )}
                                  </td>
                                );
                              })}
                              {!readOnly ? (
                                <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">
                                  {isEditingRow ? (
                                    <div className="flex flex-col items-stretch justify-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                                      <label className="flex items-center gap-1.5 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={inlineResultIsDnf}
                                          onChange={(e) => {
                                            const v = e.target.checked;
                                            setInlineResultIsDnf(v);
                                            if (v) setInlineResultIsDns(false);
                                          }}
                                          disabled={inlineResultIsDns}
                                          className="rounded border-zinc-300 disabled:opacity-50"
                                        />
                                        DNF
                                      </label>
                                      <label className="flex items-center gap-1.5 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={inlineResultIsDns}
                                          onChange={(e) => {
                                            const v = e.target.checked;
                                            setInlineResultIsDns(v);
                                            if (v) setInlineResultIsDnf(false);
                                          }}
                                          disabled={inlineResultIsDnf}
                                          className="rounded border-zinc-300 disabled:opacity-50"
                                        />
                                        DNS
                                      </label>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void onSaveInlineResult(match.id)}
                                        className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:bg-zinc-100 dark:text-zinc-900"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onCancelInlineResultEdit()}
                                        className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:border-zinc-700 dark:hover:bg-zinc-900"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        onStartInlineResultEdit(
                                          match.id,
                                          match.league_id,
                                          matchSets,
                                          match.status,
                                        )
                                      }
                                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1 sm:text-xs dark:border-zinc-700 dark:hover:bg-zinc-900"
                                    >
                                      {matchSets.length > 0 ? "Edit" : "Set"}
                                    </button>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
