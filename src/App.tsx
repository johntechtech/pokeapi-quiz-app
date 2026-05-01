import {
  ArrowClockwise,
  BookOpen,
  Brain,
  CheckCircle,
  House,
  Eye,
  FloppyDisk,
  Lightning,
  Medal,
  Play,
  Shield,
  Trophy,
  User,
  XCircle,
  type IconProps,
} from "@phosphor-icons/react";
import { type FormEvent, type ReactElement, type ReactNode, useMemo, useState } from "react";
import { fetchRandomPokemonQuizData } from "./lib/pokeapi";
import {
  TOTAL_QUESTIONS,
  createQuizRound,
  difficultyDescriptions,
  difficultyLabels,
  formatElapsed,
  isCorrectAnswer,
  registerWrongAnswer,
  revealNextHint,
  shouldShowPokemonImage,
  shouldUseBlackSilhouette,
  visibleClues,
} from "./lib/quiz";
import { loadRankings, saveRankingEntry } from "./lib/ranking";
import type { Difficulty, QuizClue, QuizRound, RankingEntry } from "./lib/types";

type GameStatus = "idle" | "loading" | "playing" | "answered" | "finished" | "error";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type LastAnswer = { correct: boolean; score: number; answer: string };
type IconComponent = React.ComponentType<IconProps>;

const difficultyIcons: Record<Difficulty, IconComponent> = {
  kids: BookOpen,
  adult: Medal,
  professor: Brain,
  trainer: Lightning,
};

const difficultyAccents: Record<Difficulty, string> = {
  kids: "border-[#ef8a56] bg-[#fff7ed]",
  adult: "border-[#5aa89c] bg-[#effaf6]",
  professor: "border-[#6f88c7] bg-[#f3f6ff]",
  trainer: "border-[#d0a331] bg-[#fff9e6]",
};

const difficultyOrder: Difficulty[] = ["kids", "adult", "professor", "trainer"];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function scrollToQuizTop() {
  if (typeof window === "undefined") {
    return;
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section className={cx("rounded-[1.75rem] border border-stone-200/80 bg-white/86 shadow-sm", className)}>
      {children}
    </section>
  );
}

function IconButton({
  children,
  icon: Icon,
  onClick,
  disabled,
  className,
  type = "button",
  variant = "primary",
}: {
  children: ReactNode;
  icon: IconComponent;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger" | "cta";
}): ReactElement {
  const variantClass = {
    primary: "border-[#22201d] bg-[#22201d] text-white hover:bg-[#34312d]",
    secondary: "border-stone-300 bg-white text-stone-900 hover:border-stone-500",
    ghost: "border-transparent bg-transparent text-stone-700 hover:bg-stone-100",
    danger: "border-[#c56e58] bg-[#fff4ef] text-[#8d321e] hover:border-[#9d4b34]",
    cta: "border-[#b7831f] bg-[#f2bd45] text-stone-950 shadow-[0_18px_30px_-22px_rgba(123,77,16,0.78)] hover:bg-[#ffd15b]",
  }[variant];

  return (
    <button
      aria-label={typeof children === "string" ? children : undefined}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold transition duration-200 active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-45",
        variantClass,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      <Icon aria-hidden size={18} weight="bold" />
      <span>{children}</span>
    </button>
  );
}

function DifficultySelector({
  selected,
  onSelect,
}: {
  selected: Difficulty;
  onSelect: (difficulty: Difficulty) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {difficultyOrder.map((difficulty) => {
        const Icon = difficultyIcons[difficulty];
        const active = selected === difficulty;

        return (
          <button
            className={cx(
              "group min-h-36 rounded-[1.5rem] border p-5 text-left transition duration-200 active:translate-y-[1px]",
              active ? difficultyAccents[difficulty] : "border-stone-200 bg-white hover:border-stone-400",
            )}
            key={difficulty}
            onClick={() => onSelect(difficulty)}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">MODE</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">
                  {difficultyLabels[difficulty]}
                </h2>
              </div>
              <span
                className={cx(
                  "grid size-11 place-items-center rounded-full border transition duration-200",
                  active
                    ? "border-stone-900 bg-stone-950 text-white"
                    : "border-stone-200 bg-stone-50 text-stone-700 group-hover:border-stone-500",
                )}
              >
                <Icon aria-hidden size={22} weight="bold" />
              </span>
            </div>
            <p className="mt-5 max-w-[26ch] text-sm leading-6 text-stone-600">
              {difficultyDescriptions[difficulty]}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function RankingPanel({
  entries,
  difficulty,
}: {
  entries: RankingEntry[];
  difficulty: Difficulty;
}): ReactElement {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">RANKING</p>
          <h2 className="mt-1 text-lg font-black text-stone-950">
            {difficultyLabels[difficulty]} トップ10
          </h2>
        </div>
        <Trophy aria-hidden className="text-[#d0a331]" size={26} weight="bold" />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
          まだ記録がありません。
        </div>
      ) : (
        <ol className="divide-y divide-stone-100">
          {entries.map((entry, index) => (
            <li className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={`${entry.completedAt}-${index}`}>
              <span className="font-mono text-sm font-black text-stone-400">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-950">{entry.playerName}</p>
                <p className="text-xs text-stone-500">
                  {formatElapsed(entry.elapsedMs)} / ヒント {entry.hintsUsed}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-black text-stone-950">{entry.score}</p>
                <p className="text-xs text-stone-400">{formatDate(entry.completedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ClueList({ clues }: { clues: QuizClue[] }): ReactElement {
  return (
    <div className="space-y-3">
      {clues.map((clueItem, index) => (
        <div
          className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_28px_-24px_rgba(38,32,24,0.5)]"
          key={`${clueItem.id}-${index}`}
          style={{ animationDelay: `${index * 55}ms` }}
        >
          <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-stone-400">
            {clueItem.label}
          </p>
          {clueItem.kind === "audio" ? (
            <audio className="mt-3 w-full" controls preload="none" src={clueItem.value}>
              鳴き声を再生できません。
            </audio>
          ) : (
            <p
              className={cx(
                "mt-1 break-words text-base font-bold leading-7 text-stone-950",
                clueItem.kind === "name" && "font-mono text-2xl tracking-normal",
              )}
            >
              {clueItem.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PokemonVisual({
  round,
  revealColorImage = false,
}: {
  round: QuizRound | null;
  revealColorImage?: boolean;
}): ReactElement {
  const canShow = revealColorImage || (round ? shouldShowPokemonImage(round) : false);
  const isBlack = revealColorImage ? false : round ? shouldUseBlackSilhouette(round) : false;
  const src = round?.pokemon.artworkUrl || round?.pokemon.spriteUrl || "";

  return (
    <div className="relative grid min-h-[18rem] place-items-center overflow-hidden rounded-[2rem] border border-stone-200 bg-[#f7f2e9] p-8">
      <div className="absolute inset-x-8 bottom-8 h-px bg-stone-300/80" />
      {canShow && src ? (
        <img
          alt={isBlack ? "ポケモンの黒いシルエット" : "ポケモンの姿"}
          className={cx(
            "relative z-[1] max-h-[18rem] w-full max-w-[22rem] object-contain drop-shadow-[0_26px_24px_rgba(54,45,33,0.18)] transition duration-500",
            isBlack && "brightness-0 contrast-200 saturate-0 opacity-90",
          )}
          draggable={false}
          src={src}
        />
      ) : (
        <div className="relative z-[1] flex min-h-48 w-full max-w-[18rem] items-center justify-center rounded-full border border-dashed border-stone-300 bg-white/45 px-8 text-center text-sm font-bold leading-6 text-stone-500">
          まだ姿は伏せられています
        </div>
      )}
    </div>
  );
}

function NoticeBox({ notice }: { notice: Notice }): ReactElement | null {
  if (!notice) {
    return null;
  }

  const Icon = notice.tone === "success" ? CheckCircle : notice.tone === "error" ? XCircle : Shield;
  const toneClass = {
    success: "border-[#68a783] bg-[#effaf3] text-[#23563a]",
    error: "border-[#dd927e] bg-[#fff4ef] text-[#87341f]",
    info: "border-[#8da0d2] bg-[#f3f6ff] text-[#33477f]",
  }[notice.tone];

  return (
    <div className={cx("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold", toneClass)}>
      <Icon aria-hidden className="mt-0.5 shrink-0" size={18} weight="bold" />
      <p>{notice.text}</p>
    </div>
  );
}

function RoundResultBanner({
  result,
  actionIcon,
  actionLabel,
  onAction,
}: {
  result: LastAnswer;
  actionIcon: IconComponent;
  actionLabel: string;
  onAction: () => void;
}): ReactElement {
  const Icon = result.correct ? CheckCircle : XCircle;
  const toneClass = result.correct
    ? "border-[#5aa89c] bg-[#effaf3] text-[#23563a]"
    : "border-[#dd927e] bg-[#fff4ef] text-[#87341f]";

  return (
    <div
      aria-live="polite"
      className={cx("round-result-banner rounded-[1.75rem] border p-5 shadow-sm", toneClass)}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/78">
            <Icon aria-hidden size={34} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">
              {result.correct ? "ANSWER CLEAR" : "ANSWER"}
            </p>
            <h3 className="mt-1 text-4xl font-black leading-none tracking-tight text-stone-950 md:text-5xl">
              {result.correct ? "正解" : "答え"}
            </h3>
          </div>
        </div>

        <IconButton className="next-question-button" icon={actionIcon} onClick={onAction} variant="cta">
          {actionLabel}
        </IconButton>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0 rounded-2xl bg-white/70 px-4 py-3">
          <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] opacity-70">POKEMON</p>
          <p className="mt-1 truncate text-2xl font-black text-stone-950">{result.answer}</p>
        </div>
        <div className="rounded-2xl bg-white/70 px-4 py-3 sm:min-w-36 sm:text-right">
          <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] opacity-70">SCORE</p>
          <p className="mt-1 font-mono text-3xl font-black leading-none text-stone-950">
            {result.score}
            <span className="ml-1 text-sm font-black text-stone-500">pt</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }): ReactElement {
  const ratio = Math.max(0, Math.min(1, score / 100));
  const toneClass =
    score >= 70 ? "bg-[#5aa89c]" : score >= 40 ? "bg-[#d0a331]" : "bg-[#c56e58]";

  return (
    <div
      aria-label={`現在この問題で獲得できる点数は${score}点です`}
      className="w-full min-w-[14rem] rounded-[1.25rem] border border-stone-300 bg-stone-50 px-4 py-3"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-stone-600">今この問題で獲得できるポイント</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-2xl font-black leading-none text-stone-950">{score}</span>
          <span className="ml-1 text-xs font-black text-stone-500">pt</span>
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[0.7rem] font-bold text-stone-500">ヒントで減少</span>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              className={cx(
                "block size-1.5 rounded-full transition-colors duration-500",
                index < Math.ceil((score / 100) * 6) ? "bg-stone-900" : "bg-stone-300",
              )}
              key={index}
            />
          ))}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-stone-300 bg-stone-200">
        <div
          className={cx(
            "h-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            toneClass,
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}

export default function App(): ReactElement {
  const [difficulty, setDifficulty] = useState<Difficulty>("kids");
  const [status, setStatus] = useState<GameStatus>("idle");
  const [round, setRound] = useState<QuizRound | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [saved, setSaved] = useState(false);
  const [rankings, setRankings] = useState(loadRankings);
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);

  const currentClues = useMemo(() => (round ? visibleClues(round) : []), [round]);
  const elapsedMs = finishedAt && startedAt ? finishedAt - startedAt : 0;
  const activeRanking = rankings[difficulty] ?? [];
  const isQuizActive = (status === "playing" || status === "answered") && round !== null;

  async function prepareRound(nextQuestionNumber: number, excludedIds: number[]) {
    setStatus("loading");
    setNotice(null);
    setAnswer("");
    setLastAnswer(null);
    setQuestionNumber(nextQuestionNumber);

    try {
      const pokemon = await fetchRandomPokemonQuizData(excludedIds, {
        includeProfessorData: difficulty === "professor",
        includeBattleData: difficulty === "trainer",
      });
      const nextRound = createQuizRound(pokemon, difficulty);
      setRound(nextRound);
      setUsedIds([...excludedIds, pokemon.id]);
      setStatus("playing");
    } catch (error) {
      setRound(null);
      setStatus("error");
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "PokeAPIからデータを取得できませんでした。",
      });
    }
  }

  function startGame() {
    setTotalScore(0);
    setTotalHints(0);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setUsedIds([]);
    setSaved(false);
    setPlayerName("");
    void prepareRound(1, []);
  }

  function returnHome() {
    setStatus("idle");
    setRound(null);
    setQuestionNumber(0);
    setUsedIds([]);
    setAnswer("");
    setNotice(null);
    setTotalScore(0);
    setTotalHints(0);
    setStartedAt(null);
    setFinishedAt(null);
    setPlayerName("");
    setSaved(false);
    setLastAnswer(null);
  }

  function handleHint() {
    if (!round || status !== "playing") {
      return;
    }

    if (round.revealedHints >= round.maxHints) {
      setNotice({ tone: "info", text: "この問題のヒントはここまでです。" });
      return;
    }

    const nextRound = revealNextHint(round);
    setRound(nextRound);
    setNotice(null);
  }

  function handleAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!round || status !== "playing") {
      return;
    }

    if (!answer.trim()) {
      setNotice({ tone: "error", text: "ポケモンの名前を入力してください。" });
      return;
    }

    if (!isCorrectAnswer(answer, round.pokemon)) {
      const nextRound = registerWrongAnswer(round);
      const scoreLoss = round.score - nextRound.score;
      setRound(nextRound);
      setNotice({ tone: "error", text: scoreLoss > 0 ? `まだ違います。-${scoreLoss}点` : "まだ違います。" });
      return;
    }

    const score = round.score;
    setTotalScore((current) => current + score);
    setTotalHints((current) => current + round.revealedHints);
    setStatus("answered");
    setNotice({ tone: "success", text: `正解！${score}点獲得しました。` });
    setLastAnswer({ correct: true, score, answer: round.pokemon.displayNameJa });
    scrollToQuizTop();
  }

  function skipRound() {
    if (!round || status !== "playing") {
      return;
    }

    setTotalHints((current) => current + round.revealedHints);
    setStatus("answered");
    setNotice({ tone: "info", text: `答えは ${round.pokemon.displayNameJa} でした。` });
    setLastAnswer({ correct: false, score: 0, answer: round.pokemon.displayNameJa });
    scrollToQuizTop();
  }

  function goNext() {
    if (questionNumber >= TOTAL_QUESTIONS) {
      setFinishedAt(Date.now());
      setRound(null);
      setStatus("finished");
      setNotice(null);
      return;
    }

    void prepareRound(questionNumber + 1, usedIds);
  }

  function retryLoad() {
    void prepareRound(Math.max(questionNumber, 1), usedIds);
  }

  function saveResult() {
    if (saved || status !== "finished") {
      return;
    }

    const entry: RankingEntry = {
      difficulty,
      playerName: playerName.trim() || "プレイヤー",
      score: totalScore,
      hintsUsed: totalHints,
      elapsedMs,
      completedAt: new Date().toISOString(),
    };
    setRankings(saveRankingEntry(entry));
    setSaved(true);
  }

  return (
    <main className="min-h-[100dvh] bg-[#f6f1e8] text-stone-950">
      <div
        className={cx(
          "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-8 md:py-8",
          isQuizActive && "quiz-active-shell",
        )}
      >
        <header
          className={cx(
            "flex flex-col gap-4 border-b border-stone-300/70 pb-5 md:flex-row md:items-end md:justify-between",
            isQuizActive && "quiz-active-header",
          )}
        >
          <div className={cx(isQuizActive && "max-md:hidden")}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a563c]">PokeAPI Quiz</p>
            <h1 className="mt-2 max-w-3xl text-4xl font-black leading-none tracking-tight text-stone-950 md:text-6xl">
              ポケモンを当てる。
            </h1>
          </div>
          {isQuizActive && round && (
            <div className="quiz-mobile-meta md:hidden">
              <div className="min-w-0">
                <p>QUESTION {questionNumber}</p>
                <h2>{difficultyLabels[difficulty]} モード</h2>
              </div>
              <IconButton className="quiz-mobile-home" icon={House} onClick={returnHome} variant="ghost">
                ホームへ戻る
              </IconButton>
            </div>
          )}
          {status !== "idle" && (
            <div className={cx("grid grid-cols-3 gap-2 text-sm md:min-w-[22rem]", isQuizActive && "quiz-mobile-stats")}>
              <div className="rounded-2xl border border-stone-300 bg-white px-4 py-3">
                <p className="text-xs font-bold text-stone-500">問題</p>
                <p className="font-mono text-xl font-black">{questionNumber || 0}/8</p>
              </div>
              <div className="rounded-2xl border border-stone-300 bg-white px-4 py-3">
                <p className="text-xs font-bold text-stone-500">得点</p>
                <p className="font-mono text-xl font-black">{totalScore}</p>
              </div>
              <div className="rounded-2xl border border-stone-300 bg-white px-4 py-3">
                <p className="text-xs font-bold text-stone-500">ヒント</p>
                <p className="font-mono text-xl font-black">{totalHints}</p>
              </div>
            </div>
          )}
        </header>

        {status === "idle" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
            <Panel className="p-5 md:p-7">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">DIFFICULTY</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">レベルを選ぶ</h2>
                </div>
                <IconButton icon={Play} onClick={startGame}>
                  はじめる
                </IconButton>
              </div>
              <DifficultySelector selected={difficulty} onSelect={setDifficulty} />
            </Panel>
            <RankingPanel difficulty={difficulty} entries={activeRanking} />
          </div>
        )}

        {status === "loading" && (
          <Panel className="grid min-h-[26rem] place-items-center p-6">
            <div className="w-full max-w-xl space-y-4">
              <div className="h-6 w-40 animate-pulse rounded-full bg-stone-300" />
              <div className="h-28 animate-pulse rounded-[1.5rem] bg-white" />
              <div className="h-12 animate-pulse rounded-full bg-stone-300" />
              <p className="text-sm font-bold text-stone-500">PokeAPIからポケモンをセットしています。</p>
            </div>
          </Panel>
        )}

        {status === "error" && (
          <Panel className="grid min-h-[22rem] place-items-center p-6 text-center">
            <div className="max-w-lg space-y-5">
              <XCircle aria-hidden className="mx-auto text-[#9a563c]" size={44} weight="bold" />
              <NoticeBox notice={notice} />
              <IconButton icon={ArrowClockwise} onClick={retryLoad}>
                もう一度取得する
              </IconButton>
            </div>
          </Panel>
        )}

        {(status === "playing" || status === "answered") && round && (
          <div
            className={cx(
              "grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)]",
              status === "playing" && "playing-layout",
            )}
          >
            <div className="quiz-clue-column space-y-4">
              <Panel className="quiz-meta max-md:hidden p-3 md:p-5">
                <div className="flex items-center justify-between gap-3 md:flex-wrap md:gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-stone-500 md:text-xs md:tracking-[0.18em]">
                      QUESTION {questionNumber}
                    </p>
                    <h2 className="mt-0.5 truncate text-base font-black tracking-tight text-stone-950 md:mt-1 md:text-2xl">
                      {difficultyLabels[difficulty]} モード
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 md:w-auto md:gap-3">
                    <div className="hidden md:block">
                      <ScoreGauge score={round.score} />
                    </div>
                    <IconButton
                      className="max-md:min-h-10 max-md:px-3 max-md:text-xs"
                      icon={House}
                      onClick={returnHome}
                      variant="ghost"
                    >
                      ホームへ戻る
                    </IconButton>
                  </div>
                </div>
              </Panel>

              <Panel className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-stone-950">ヒント</h3>
                  </div>
                  <Eye aria-hidden className="text-[#5aa89c]" size={26} weight="bold" />
                </div>
                <ClueList clues={currentClues} />
              </Panel>
            </div>

            <div className="quiz-visual-column space-y-4">
              {status === "answered" && lastAnswer && (
                <RoundResultBanner
                  actionIcon={questionNumber >= TOTAL_QUESTIONS ? Trophy : Play}
                  actionLabel={questionNumber >= TOTAL_QUESTIONS ? "結果を見る" : "次の問題"}
                  onAction={goNext}
                  result={lastAnswer}
                />
              )}

              <PokemonVisual
                revealColorImage={status === "answered" && round.difficulty !== "kids"}
                round={round}
              />

              {status === "playing" && (
                <Panel className="answer-dock p-5">
                  <form className="space-y-4" onSubmit={handleAnswer}>
                    <div>
                      <label className="block text-sm font-black text-stone-950" htmlFor="answer">
                        ポケモンの名前
                      </label>
                      <input
                        autoComplete="off"
                        className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-lg font-bold outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-900/10 disabled:bg-stone-100"
                        disabled={status !== "playing"}
                        id="answer"
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder={difficulty === "kids" ? "ひらがなでもOK" : "カタカナでもひらがなでもOK"}
                        value={answer}
                      />
                    </div>

                    <NoticeBox notice={notice} />

                    <div className="answer-actions grid grid-cols-3 items-end gap-2 md:flex md:flex-wrap md:gap-3">
                      <IconButton className="max-md:w-full" icon={CheckCircle} type="submit">
                        回答
                      </IconButton>
                      <div className="hint-action md:contents">
                        <div aria-live="polite" className="hint-score-badge md:hidden">
                          <span>獲得</span>
                          <strong>{round.score}pt</strong>
                        </div>
                        <IconButton
                          className="max-md:w-full"
                          disabled={round.revealedHints >= round.maxHints}
                          icon={Eye}
                          onClick={handleHint}
                          variant="secondary"
                        >
                          ヒント
                        </IconButton>
                      </div>
                      <IconButton className="max-md:w-full" icon={XCircle} onClick={skipRound} variant="danger">
                        スキップ
                      </IconButton>
                    </div>
                  </form>
                </Panel>
              )}
            </div>
          </div>
        )}

        {status === "finished" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
            <Panel className="p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a563c]">RESULT</p>
                  <h2 className="mt-3 text-4xl font-black leading-none tracking-tight text-stone-950 md:text-6xl">
                    {totalScore} / 800
                  </h2>
                  <p className="mt-4 text-sm font-bold leading-6 text-stone-600">
                    {difficultyLabels[difficulty]}モードを完走しました。ヒント {totalHints} 回、
                    タイム {formatElapsed(elapsedMs)}。
                  </p>
                </div>
                <Trophy aria-hidden className="text-[#d0a331]" size={54} weight="fill" />
              </div>

              <div className="mt-8 max-w-xl">
                <label className="block text-sm font-black text-stone-950" htmlFor="playerName">
                  プレイヤー名
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <User
                      aria-hidden
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                      size={18}
                      weight="bold"
                    />
                    <input
                      className="min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-11 text-base font-bold outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-900/10 disabled:bg-stone-100"
                      disabled={saved}
                      id="playerName"
                      maxLength={24}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="プレイヤー"
                      value={playerName}
                    />
                  </div>
                  <IconButton disabled={saved} icon={FloppyDisk} onClick={saveResult}>
                    {saved ? "保存済み" : "保存"}
                  </IconButton>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <IconButton icon={ArrowClockwise} onClick={startGame} variant="secondary">
                  同じレベルでもう一度
                </IconButton>
                <IconButton icon={Shield} onClick={returnHome} variant="ghost">
                  レベル選択へ
                </IconButton>
              </div>
            </Panel>
            <RankingPanel difficulty={difficulty} entries={activeRanking} />
          </div>
        )}
      </div>
    </main>
  );
}
