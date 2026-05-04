import {
  ArrowClockwise,
  BookOpen,
  Brain,
  CaretDown,
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
import { type FormEvent, type ReactElement, type ReactNode, useEffect, useMemo, useState } from "react";
import { fetchRandomPokemonQuizData } from "./lib/pokeapi";
import {
  createSilhouetteQuizRound,
  createTrainerQuizRound,
  createQuizRound,
  difficultyDescriptions,
  difficultyLabels,
  formatElapsed,
  isCorrectAnswer,
  isCorrectStructuredAnswer,
  isTextAnswerRound,
  professorLevelDescriptions,
  professorLevelLabels,
  professorLevelOrder,
  registerWrongAnswer,
  revealNextHint,
  shouldShowPokemonImage,
  shouldUseBlackSilhouette,
  silhouetteLevelDescriptions,
  silhouetteLevelLabels,
  silhouetteLevelOrder,
  totalQuestionsForMode,
  trainerLevelDescriptions,
  trainerLevelLabels,
  trainerLevelOrder,
  visibleClues,
} from "./lib/quiz";
import { getRankingKey, loadRankings, saveRankingEntry } from "./lib/ranking";
import type {
  Difficulty,
  ProfessorLevel,
  QuizChoice,
  QuizClue,
  QuizRound,
  RankingEntry,
  RankingKey,
  SilhouetteLevel,
  TrainerLevel,
} from "./lib/types";

type GameStatus = "idle" | "loading" | "playing" | "answered" | "finished" | "error";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type LastAnswer = { correct: boolean; score: number; answer: string; detail?: string };
type IconComponent = React.ComponentType<IconProps>;
type HomeModePokemon = { id: number; name: string; type: string; note: string };
type GenerationId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface GenerationOption {
  id: GenerationId;
  label: string;
  games: string;
  start: number;
  end: number;
}

const difficultyIcons: Record<Difficulty, IconComponent> = {
  kids: BookOpen,
  adult: Medal,
  professor: Brain,
  trainer: Lightning,
  silhouette: Eye,
};

const difficultyAccents: Record<Difficulty, string> = {
  kids: "border-[#ef8a56] bg-[#fff7ed]",
  adult: "border-[#5aa89c] bg-[#effaf6]",
  professor: "border-[#6f88c7] bg-[#f3f6ff]",
  trainer: "border-[#d0a331] bg-[#fff9e6]",
  silhouette: "border-[#7f8f7c] bg-[#f5f8f1]",
};

const difficultyOrder: Difficulty[] = ["kids", "adult", "professor", "trainer", "silhouette"];

const generationOptions: GenerationOption[] = [
  { id: 1, label: "第1世代", games: "赤・緑、青、ピカチュウ", start: 1, end: 151 },
  { id: 2, label: "第2世代", games: "金・銀、クリスタル", start: 152, end: 251 },
  { id: 3, label: "第3世代", games: "ルビー・サファイア、エメラルド", start: 252, end: 386 },
  { id: 4, label: "第4世代", games: "ダイヤモンド・パール、プラチナ", start: 387, end: 493 },
  { id: 5, label: "第5世代", games: "ブラック・ホワイト、ブラック2・ホワイト2", start: 494, end: 649 },
  { id: 6, label: "第6世代", games: "X・Y", start: 650, end: 721 },
  { id: 7, label: "第7世代", games: "サン・ムーン、ウルトラサン・ウルトラムーン", start: 722, end: 809 },
  { id: 8, label: "第8世代", games: "ソード・シールド、LEGENDS アルセウス", start: 810, end: 905 },
  { id: 9, label: "第9世代", games: "スカーレット・バイオレット", start: 906, end: 1025 },
];

const allGenerationIds = generationOptions.map((generation) => generation.id);

const modePokemonPools: Record<Difficulty, HomeModePokemon[]> = {
  kids: [
    { id: 25, name: "ピカチュウ", type: "でんき", note: "見た目で答えやすい" },
    { id: 133, name: "イーブイ", type: "ノーマル", note: "親しみやすい人気ポケモン" },
    { id: 7, name: "ゼニガメ", type: "みず", note: "シルエットが分かりやすい" },
  ],
  adult: [
    { id: 94, name: "ゲンガー", type: "ゴースト / どく", note: "タイプ推理向き" },
    { id: 448, name: "ルカリオ", type: "かくとう / はがね", note: "姿とタイプの手がかりが強い" },
    { id: 658, name: "ゲッコウガ", type: "みず / あく", note: "特徴から絞り込みやすい" },
  ],
  professor: [
    { id: 151, name: "ミュウ", type: "エスパー", note: "図鑑知識で差が出る" },
    { id: 201, name: "アンノーン", type: "エスパー", note: "分類や説明が手がかり" },
    { id: 474, name: "ポリゴンZ", type: "ノーマル", note: "設定を読むほど有利" },
  ],
  trainer: [
    { id: 149, name: "カイリュー", type: "ドラゴン / ひこう", note: "バトル知識向き" },
    { id: 445, name: "ガブリアス", type: "ドラゴン / じめん", note: "相性推理が楽しい" },
    { id: 6, name: "リザードン", type: "ほのお / ひこう", note: "弱点と耐性が鍵" },
  ],
  silhouette: [
    { id: 132, name: "メタモン", type: "ノーマル", note: "影を見分ける瞬発力" },
    { id: 778, name: "ミミッキュ", type: "ゴースト / フェアリー", note: "輪郭観察が勝負" },
    { id: 359, name: "アブソル", type: "あく", note: "一瞬で形を読む" },
  ],
};

function officialArtworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function pickModePokemon(): Record<Difficulty, HomeModePokemon> {
  return difficultyOrder.reduce((result, difficulty) => {
    const pool = modePokemonPools[difficulty];
    result[difficulty] = pool[Math.floor(Math.random() * pool.length)];
    return result;
  }, {} as Record<Difficulty, HomeModePokemon>);
}

function countGenerationPokemon(generation: GenerationOption): number {
  return generation.end - generation.start + 1;
}

function speciesIdsForGenerations(selectedIds: GenerationId[]): number[] {
  const selected = new Set(selectedIds);

  return generationOptions.flatMap((generation) => {
    if (!selected.has(generation.id)) {
      return [];
    }

    return Array.from(
      { length: countGenerationPokemon(generation) },
      (_, index) => generation.start + index,
    );
  });
}

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

function formatModeName(
  difficulty: Difficulty,
  professorLevel?: ProfessorLevel | null,
  trainerLevel?: TrainerLevel | null,
  silhouetteLevel?: SilhouetteLevel | null,
): string {
  if (difficulty === "professor" && professorLevel) {
    return `博士モード（${professorLevelLabels[professorLevel]}）`;
  }

  if (difficulty === "trainer" && trainerLevel) {
    return `トレーナーモード（${trainerLevelLabels[trainerLevel]}）`;
  }

  if (difficulty === "silhouette" && silhouetteLevel) {
    return `シルエットタイムアタック（${silhouetteLevelLabels[silhouetteLevel]}）`;
  }

  return `${difficultyLabels[difficulty]}モード`;
}

function formatRankingName(
  difficulty: Difficulty | null,
  professorLevel: ProfessorLevel | null,
  trainerLevel: TrainerLevel | null,
  silhouetteLevel: SilhouetteLevel | null,
): string | null {
  if (!difficulty) {
    return null;
  }

  if (difficulty === "professor") {
    return professorLevel ? `博士（${professorLevelLabels[professorLevel]}）` : null;
  }

  if (difficulty === "trainer") {
    return trainerLevel ? `トレーナー（${trainerLevelLabels[trainerLevel]}）` : null;
  }

  if (difficulty === "silhouette") {
    return silhouetteLevel ? `シルエットTA（${silhouetteLevelLabels[silhouetteLevel]}）` : null;
  }

  return difficultyLabels[difficulty];
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
  ariaDescribedBy,
  ariaDisabled,
  disabled,
  className,
  type = "button",
  variant = "primary",
}: {
  children: ReactNode;
  icon: IconComponent;
  onClick?: () => void;
  ariaDescribedBy?: string;
  ariaDisabled?: boolean;
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
  const disabledLike = disabled || ariaDisabled;

  return (
    <button
      aria-describedby={ariaDescribedBy}
      aria-disabled={ariaDisabled || undefined}
      aria-label={typeof children === "string" ? children : undefined}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold transition duration-200 active:translate-y-[1px] disabled:pointer-events-none",
        variantClass,
        disabledLike && "opacity-45",
        ariaDisabled && "cursor-not-allowed",
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
  selectedProfessorLevel,
  selectedTrainerLevel,
  selectedSilhouetteLevel,
  onSelect,
  onSelectProfessorLevel,
  onSelectTrainerLevel,
  onSelectSilhouetteLevel,
  modePokemon,
}: {
  selected: Difficulty | null;
  selectedProfessorLevel: ProfessorLevel | null;
  selectedTrainerLevel: TrainerLevel | null;
  selectedSilhouetteLevel: SilhouetteLevel | null;
  onSelect: (difficulty: Difficulty) => void;
  onSelectProfessorLevel: (level: ProfessorLevel) => void;
  onSelectTrainerLevel: (level: TrainerLevel) => void;
  onSelectSilhouetteLevel: (level: SilhouetteLevel) => void;
  modePokemon: Record<Difficulty, HomeModePokemon>;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {difficultyOrder.map((difficulty) => {
        const Icon = difficultyIcons[difficulty];
        const active = selected === difficulty;
        const pokemon = modePokemon[difficulty];

        return (
          <div className="difficulty-card-shell" key={difficulty}>
            <button
              aria-pressed={active}
              className={cx(
                "group min-h-44 w-full overflow-hidden rounded-[1.5rem] border p-5 text-left transition duration-200 active:translate-y-[1px]",
                active ? difficultyAccents[difficulty] : "border-stone-200 bg-white hover:border-stone-400",
              )}
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
              <div className="mode-pokemon">
                <div className="mode-pokemon-copy">
                  <p>{pokemon.note}</p>
                  <strong>{pokemon.name}</strong>
                  <span>{pokemon.type}</span>
                </div>
                <img
                  alt={`${difficultyLabels[difficulty]}モードにおすすめの${pokemon.name}`}
                  draggable={false}
                  src={officialArtworkUrl(pokemon.id)}
                />
              </div>
            </button>

            {difficulty === "professor" && active && (
              <div className="professor-level-panel" aria-label="博士モードのレベル">
                {professorLevelOrder.map((level) => {
                  const levelActive = selectedProfessorLevel === level;

                  return (
                    <button
                      aria-pressed={levelActive}
                      className={cx("professor-level-option", levelActive && "is-active")}
                      key={level}
                      onClick={() => onSelectProfessorLevel(level)}
                      type="button"
                    >
                      <span>博士モード</span>
                      <strong>{professorLevelLabels[level]}</strong>
                      <small>{professorLevelDescriptions[level]}</small>
                    </button>
                  );
                })}
              </div>
            )}

            {difficulty === "trainer" && active && (
              <div className="professor-level-panel" aria-label="トレーナーモードのレベル">
                {trainerLevelOrder.map((level) => {
                  const levelActive = selectedTrainerLevel === level;

                  return (
                    <button
                      aria-pressed={levelActive}
                      className={cx("professor-level-option", levelActive && "is-active")}
                      key={level}
                      onClick={() => onSelectTrainerLevel(level)}
                      type="button"
                    >
                      <span>トレーナーモード</span>
                      <strong>{trainerLevelLabels[level]}</strong>
                      <small>{trainerLevelDescriptions[level]}</small>
                    </button>
                  );
                })}
              </div>
            )}

            {difficulty === "silhouette" && active && (
              <div className="professor-level-panel" aria-label="シルエットタイムアタックのレベル">
                {silhouetteLevelOrder.map((level) => {
                  const levelActive = selectedSilhouetteLevel === level;

                  return (
                    <button
                      aria-pressed={levelActive}
                      className={cx("professor-level-option", levelActive && "is-active")}
                      key={level}
                      onClick={() => onSelectSilhouetteLevel(level)}
                      type="button"
                    >
                      <span>シルエットTA</span>
                      <strong>{silhouetteLevelLabels[level]}</strong>
                      <small>{silhouetteLevelDescriptions[level]}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenerationSelector({
  isOpen,
  selectedIds,
  onToggle,
  onToggleOpen,
}: {
  isOpen: boolean;
  selectedIds: GenerationId[];
  onToggle: (generationId: GenerationId) => void;
  onToggleOpen: () => void;
}): ReactElement {
  const selected = new Set(selectedIds);

  return (
    <section className="generation-selector" aria-labelledby="generation-selector-title">
      <button
        aria-controls="generation-options"
        aria-expanded={isOpen}
        className="generation-accordion-button"
        id="generation-selector-title"
        onClick={onToggleOpen}
        type="button"
      >
        <span>
          <strong>出題範囲をカスタマイズ</strong>
          <small>世代を複数選択できます</small>
        </span>
        <CaretDown aria-hidden className="generation-accordion-icon" size={20} weight="bold" />
      </button>

      {isOpen && (
        <div className="generation-options" id="generation-options">
          {generationOptions.map((generation) => {
            const checked = selected.has(generation.id);

            return (
              <label className={cx("generation-option", checked && "is-active")} key={generation.id}>
                <input
                  checked={checked}
                  onChange={() => onToggle(generation.id)}
                  type="checkbox"
                />
                <span className="generation-option-box" aria-hidden="true" />
                <span className="generation-option-text">
                  <strong>
                    {generation.label}：{generation.games}
                  </strong>
                  <span>{countGenerationPokemon(generation)}匹</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RankingPanel({
  entries,
  emptyText,
  modeLabel,
}: {
  entries: RankingEntry[];
  emptyText?: string;
  modeLabel: string | null;
}): ReactElement {
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">RANKING</p>
          <h2 className="mt-1 text-lg font-black text-stone-950">
            {modeLabel ? `${modeLabel} トップ10` : "ランキング"}
          </h2>
        </div>
        <Trophy aria-hidden className="text-[#d0a331]" size={26} weight="bold" />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
          {emptyText ?? (modeLabel ? "まだ記録がありません。" : "モードを選ぶとランキングを表示します。")}
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

function UpdateNotes(): ReactElement {
  const updates = [
    {
      date: "2026-05-04",
      label: "2026.05.04：",
      items: [
        "博士モードのヒント順をレベル別に調整し、進化の順番を追加。",
        "トレーナーモードをバトル知識クイズ専用に変更。",
        "シルエットタイムアタックを追加。",
      ],
    },
  ];

  return (
    <section className="update-notes" aria-label="バージョンアップデート">
      <h2>アップデート情報</h2>
      <div className="update-note-list">
        {updates.map((group) => (
          <div className="update-note-group" key={group.date}>
            <time dateTime={group.date}>{group.label}</time>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function FutureIdeas(): ReactElement {
  const ideas = [
    "苦手問題の復習ノート",
    "タイプ相性ビンゴ",
    "進化チェーン当て",
    "チーム補完クイズ",
    "連勝ボーナス付きサバイバル",
  ];

  return (
    <section className="future-ideas" aria-label="追加コンテンツ案">
      <h2>追加コンテンツ案</h2>
      <ul>
        {ideas.map((idea) => (
          <li key={idea}>{idea}</li>
        ))}
      </ul>
    </section>
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
          {clueItem.kind === "image" ? (
            <div className="mt-2 flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#effaf6] text-[#4d8d77]">
                <Eye aria-hidden size={19} weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="break-words text-base font-black leading-6 text-stone-950">
                  {clueItem.value}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-stone-600">
                  画面上部の姿エリアを確認してください。
                </p>
              </div>
            </div>
          ) : clueItem.kind === "audio" ? (
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
  if (round?.hidePokemonVisual && !revealColorImage) {
    return <div className="hidden" />;
  }

  const canShow = revealColorImage || (round ? shouldShowPokemonImage(round) : false);
  const isBlack = revealColorImage ? false : round ? shouldUseBlackSilhouette(round) : false;
  const src = round?.pokemon.artworkUrl || round?.pokemon.spriteUrl || "";

  return (
    <div className="relative grid min-h-[18rem] place-items-center overflow-hidden rounded-[2rem] border border-stone-200 bg-[#f7f2e9] p-8">
      <div className="absolute inset-x-8 bottom-8 h-px bg-stone-300/80" />
      {canShow && src ? (
        <img
          alt={isBlack ? "ポケモンのシルエット" : "ポケモンのカラーの姿"}
          className={cx(
            "relative z-[1] max-h-[18rem] w-full max-w-[22rem] object-contain drop-shadow-[0_26px_24px_rgba(54,45,33,0.18)] transition duration-500",
            isBlack && "brightness-0 contrast-200 saturate-0 opacity-90",
          )}
          draggable={false}
          src={src}
        />
      ) : (
        <div className="relative z-[1] flex min-h-48 w-full max-w-[18rem] items-center justify-center rounded-full border border-dashed border-stone-300 bg-white/45 px-8 text-center text-sm font-bold leading-6 text-stone-500">
          {round && !isTextAnswerRound(round) ? "バトル問題を表示中です" : "まだ姿は伏せられています"}
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

function ChoiceButton({
  choice,
  onSelect,
}: {
  choice: QuizChoice;
  onSelect: (value: string) => void;
}): ReactElement {
  return (
    <button
      className={cx("choice-answer-button", choice.imageUrl && "choice-answer-button-visual")}
      onClick={() => onSelect(choice.value)}
      type="button"
    >
      {choice.imageUrl && (
        <img
          alt={choice.imageAlt ?? choice.label}
          className={cx("choice-answer-art", choice.imageTone === "black" && "is-black")}
          draggable={false}
          src={choice.imageUrl}
        />
      )}
      <strong>{choice.label}</strong>
      {choice.description && <span>{choice.description}</span>}
    </button>
  );
}

function AnswerForm({
  round,
  answer,
  selectedAnswer,
  dualAnswer,
  notice,
  onAnswerChange,
  onSelectedAnswerChange,
  onDualAnswerChange,
  onTextSubmit,
  onChoiceAnswer,
  onStructuredSubmit,
  onHint,
  onSkip,
}: {
  round: QuizRound;
  answer: string;
  selectedAnswer: string;
  dualAnswer: { first: string; second: string };
  notice: Notice;
  onAnswerChange: (value: string) => void;
  onSelectedAnswerChange: (value: string) => void;
  onDualAnswerChange: (value: { first: string; second: string }) => void;
  onTextSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChoiceAnswer: (value: string) => void;
  onStructuredSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onHint: () => void;
  onSkip: () => void;
}): ReactElement {
  if (round.answerFormat === "choice") {
    const useMobileChoiceSelect = round.difficulty === "trainer";
    const hasImageChoices = (round.choices ?? []).some((choice) => Boolean(choice.imageUrl));

    return (
      <Panel className="answer-dock p-5">
        <div className="space-y-4">
          <div>
            <p className="block text-sm font-black text-stone-950">選択肢</p>
            {useMobileChoiceSelect && (
              <form className="mobile-choice-select md:hidden" onSubmit={onStructuredSubmit}>
                <select
                  className="quiz-select"
                  onChange={(event) => onSelectedAnswerChange(event.target.value)}
                  value={selectedAnswer}
                >
                  <option value="">選択してください</option>
                  {(round.choices ?? []).map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                <IconButton className="max-md:w-full" icon={CheckCircle} type="submit">
                  回答
                </IconButton>
              </form>
            )}
            <div
              className={cx(
                "choice-answer-grid mt-2",
                useMobileChoiceSelect && "max-md:hidden",
                hasImageChoices && "choice-answer-grid-visual",
              )}
            >
              {(round.choices ?? []).map((choice) => (
                <ChoiceButton choice={choice} key={choice.value} onSelect={onChoiceAnswer} />
              ))}
            </div>
          </div>
          <NoticeBox notice={notice} />
          <IconButton className="max-md:w-full" icon={XCircle} onClick={onSkip} variant="danger">
            スキップ
          </IconButton>
        </div>
      </Panel>
    );
  }

  if (round.answerFormat === "select") {
    return (
      <Panel className="answer-dock p-5">
        <form className="space-y-4" onSubmit={onStructuredSubmit}>
          <div>
            <label className="block text-sm font-black text-stone-950" htmlFor="structured-answer">
              答えを選ぶ
            </label>
            <select
              className="quiz-select mt-2"
              id="structured-answer"
              onChange={(event) => onSelectedAnswerChange(event.target.value)}
              value={selectedAnswer}
            >
              <option value="">選択してください</option>
              {(round.selectOptions ?? []).map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <NoticeBox notice={notice} />
          <div className="answer-actions grid grid-cols-2 items-end gap-2 md:flex md:flex-wrap md:gap-3">
            <IconButton className="max-md:w-full" icon={CheckCircle} type="submit">
              回答
            </IconButton>
            <IconButton className="max-md:w-full" icon={XCircle} onClick={onSkip} variant="danger">
              スキップ
            </IconButton>
          </div>
        </form>
      </Panel>
    );
  }

  if (round.answerFormat === "dual-select") {
    return (
      <Panel className="answer-dock p-5">
        <form className="space-y-4" onSubmit={onStructuredSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-black text-stone-950" htmlFor="dual-answer-first">
                {round.dualSelect?.firstLabel ?? "1つ目"}
              </label>
              <select
                className="quiz-select mt-2"
                id="dual-answer-first"
                onChange={(event) => onDualAnswerChange({ ...dualAnswer, first: event.target.value })}
                value={dualAnswer.first}
              >
                <option value="">選択してください</option>
                {(round.dualSelect?.firstOptions ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-stone-950" htmlFor="dual-answer-second">
                {round.dualSelect?.secondLabel ?? "2つ目"}
              </label>
              <select
                className="quiz-select mt-2"
                id="dual-answer-second"
                onChange={(event) => onDualAnswerChange({ ...dualAnswer, second: event.target.value })}
                value={dualAnswer.second}
              >
                <option value="">選択してください</option>
                {(round.dualSelect?.secondOptions ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <NoticeBox notice={notice} />
          <div className="answer-actions grid grid-cols-2 items-end gap-2 md:flex md:flex-wrap md:gap-3">
            <IconButton className="max-md:w-full" icon={CheckCircle} type="submit">
              回答
            </IconButton>
            <IconButton className="max-md:w-full" icon={XCircle} onClick={onSkip} variant="danger">
              スキップ
            </IconButton>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel className="answer-dock p-5">
      <form className="space-y-4" onSubmit={onTextSubmit}>
        <div>
          <label className="block text-sm font-black text-stone-950" htmlFor="answer">
            ポケモンの名前
          </label>
          <input
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-lg font-bold outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-stone-900/10 disabled:bg-stone-100"
            id="answer"
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder={round.difficulty === "kids" ? "ひらがなでもOK" : "カタカナでもひらがなでもOK"}
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
              onClick={onHint}
              variant="secondary"
            >
              ヒント
            </IconButton>
          </div>
          <IconButton className="max-md:w-full" icon={XCircle} onClick={onSkip} variant="danger">
            スキップ
          </IconButton>
        </div>
      </form>
    </Panel>
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
          <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] opacity-70">ANSWER</p>
          <p className="mt-1 truncate text-2xl font-black text-stone-950">{result.answer}</p>
          {result.detail && (
            <p className="mt-1 text-xs font-bold leading-5 text-stone-600">{result.detail}</p>
          )}
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
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [professorLevel, setProfessorLevel] = useState<ProfessorLevel | null>(null);
  const [trainerLevel, setTrainerLevel] = useState<TrainerLevel | null>(null);
  const [silhouetteLevel, setSilhouetteLevel] = useState<SilhouetteLevel | null>(null);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [round, setRound] = useState<QuizRound | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [dualAnswer, setDualAnswer] = useState({ first: "", second: "" });
  const [notice, setNotice] = useState<Notice>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [saved, setSaved] = useState(false);
  const [rankings, setRankings] = useState(loadRankings);
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [modePokemon, setModePokemon] = useState(pickModePokemon);
  const [selectedGenerationIds, setSelectedGenerationIds] = useState<GenerationId[]>(allGenerationIds);
  const [generationAccordionOpen, setGenerationAccordionOpen] = useState(false);
  const [startTooltipVisible, setStartTooltipVisible] = useState(false);

  const currentClues = useMemo(() => (round ? visibleClues(round) : []), [round]);
  const candidateSpeciesIds = useMemo(
    () => speciesIdsForGenerations(selectedGenerationIds),
    [selectedGenerationIds],
  );
  const elapsedMs = finishedAt && startedAt ? finishedAt - startedAt : 0;
  const hasSelectedModeLevel = Boolean(
    difficulty &&
      (difficulty !== "professor" || professorLevel) &&
      (difficulty !== "trainer" || trainerLevel) &&
      (difficulty !== "silhouette" || silhouetteLevel),
  );
  const selectedRankingKey: RankingKey | null =
    difficulty &&
    (difficulty !== "professor" || professorLevel) &&
    (difficulty !== "trainer" || trainerLevel) &&
    (difficulty !== "silhouette" || silhouetteLevel)
      ? getRankingKey(
          difficulty,
          professorLevel ?? undefined,
          trainerLevel ?? undefined,
          silhouetteLevel ?? undefined,
        )
      : null;
  const activeRanking = selectedRankingKey ? rankings[selectedRankingKey] ?? [] : [];
  const activeRankingLabel = formatRankingName(difficulty, professorLevel, trainerLevel, silhouetteLevel);
  const rankingEmptyText =
    difficulty === "professor" && !professorLevel
      ? "博士モードのレベルを選ぶとランキングを表示します。"
      : difficulty === "trainer" && !trainerLevel
        ? "トレーナーモードのレベルを選ぶとランキングを表示します。"
        : difficulty === "silhouette" && !silhouetteLevel
          ? "シルエットタイムアタックのレベルを選ぶとランキングを表示します。"
      : undefined;
  const activeModeName =
    difficulty && hasSelectedModeLevel ? formatModeName(difficulty, professorLevel, trainerLevel, silhouetteLevel) : null;
  const totalQuestions = difficulty
    ? totalQuestionsForMode(difficulty, professorLevel, trainerLevel, silhouetteLevel)
    : 0;
  const startDisabledReason = !hasSelectedModeLevel
    ? "モードとレベルを選択してください"
    : candidateSpeciesIds.length === 0
      ? "出題範囲を1つ以上選択してください"
      : "";
  const isQuizActive = (status === "playing" || status === "answered") && round !== null && difficulty !== null;
  const canStartGame = hasSelectedModeLevel && candidateSpeciesIds.length > 0;

  useEffect(() => {
    if (!startTooltipVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStartTooltipVisible(false);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [startTooltipVisible]);

  async function prepareRound(nextQuestionNumber: number, excludedIds: number[]) {
    if (
      !difficulty ||
      candidateSpeciesIds.length === 0 ||
      (difficulty === "professor" && !professorLevel) ||
      (difficulty === "trainer" && !trainerLevel) ||
      (difficulty === "silhouette" && !silhouetteLevel)
    ) {
      return;
    }

    setStatus("loading");
    setNotice(null);
    setAnswer("");
    setSelectedAnswer("");
    setDualAnswer({ first: "", second: "" });
    setLastAnswer(null);
    setQuestionNumber(nextQuestionNumber);

    try {
      const pokemon = await fetchRandomPokemonQuizData(excludedIds, {
        candidateSpeciesIds,
        includeProfessorData: difficulty === "professor",
        includeBattleData: difficulty === "trainer",
      });
      const nextRound =
        difficulty === "trainer"
          ? await createTrainerQuizRound(pokemon, trainerLevel ?? "gymLeader", candidateSpeciesIds)
          : difficulty === "silhouette"
            ? await createSilhouetteQuizRound(pokemon, silhouetteLevel ?? "kageSearcher", candidateSpeciesIds)
          : createQuizRound(pokemon, difficulty, professorLevel ?? undefined);
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
    if (!canStartGame) {
      return;
    }

    setTotalScore(0);
    setTotalHints(0);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setUsedIds([]);
    setAnswer("");
    setSelectedAnswer("");
    setDualAnswer({ first: "", second: "" });
    setSaved(false);
    setPlayerName("");
    void prepareRound(1, []);
  }

  function handleStartButtonClick() {
    if (!canStartGame) {
      setStartTooltipVisible(true);
      return;
    }

    startGame();
  }

  function handleDifficultySelect(nextDifficulty: Difficulty) {
    setDifficulty(nextDifficulty);
    setStartTooltipVisible(false);

    if (nextDifficulty !== "professor") {
      setProfessorLevel(null);
    }

    if (nextDifficulty !== "trainer") {
      setTrainerLevel(null);
    }

    if (nextDifficulty !== "silhouette") {
      setSilhouetteLevel(null);
    }
  }

  function handleProfessorLevelSelect(nextProfessorLevel: ProfessorLevel) {
    setProfessorLevel(nextProfessorLevel);
    setStartTooltipVisible(false);
  }

  function handleTrainerLevelSelect(nextTrainerLevel: TrainerLevel) {
    setTrainerLevel(nextTrainerLevel);
    setStartTooltipVisible(false);
  }

  function handleSilhouetteLevelSelect(nextSilhouetteLevel: SilhouetteLevel) {
    setSilhouetteLevel(nextSilhouetteLevel);
    setStartTooltipVisible(false);
  }

  function returnHome() {
    setStatus("idle");
    setRound(null);
    setQuestionNumber(0);
    setUsedIds([]);
    setAnswer("");
    setSelectedAnswer("");
    setDualAnswer({ first: "", second: "" });
    setNotice(null);
    setTotalScore(0);
    setTotalHints(0);
    setStartedAt(null);
    setFinishedAt(null);
    setPlayerName("");
    setSaved(false);
    setLastAnswer(null);
    setDifficulty(null);
    setProfessorLevel(null);
    setTrainerLevel(null);
    setSilhouetteLevel(null);
    setModePokemon(pickModePokemon());
    setStartTooltipVisible(false);
  }

  function toggleGeneration(generationId: GenerationId) {
    setStartTooltipVisible(false);
    setSelectedGenerationIds((current) =>
      current.includes(generationId)
        ? current.filter((id) => id !== generationId)
        : [...current, generationId].sort((a, b) => a - b),
    );
  }

  function handleHint() {
    if (!round || status !== "playing" || !isTextAnswerRound(round)) {
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

  function finishRound(correct: boolean, score: number, answerLabel: string, detail?: string) {
    setTotalScore((current) => current + score);
    setTotalHints((current) => current + (round?.revealedHints ?? 0));
    setStatus("answered");
    setNotice({
      tone: correct ? "success" : "info",
      text: correct ? `正解！${score}点獲得しました。` : `答えは ${answerLabel} でした。`,
    });
    setLastAnswer({ correct, score, answer: answerLabel, detail });
    scrollToQuizTop();
  }

  function handleAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!round || status !== "playing" || !isTextAnswerRound(round)) {
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
    finishRound(true, score, round.pokemon.displayNameJa);
  }

  function handleChoiceAnswer(value: string) {
    if (!round || status !== "playing" || isTextAnswerRound(round)) {
      return;
    }

    const correct = isCorrectStructuredAnswer(round, value);
    finishRound(
      correct,
      correct ? 100 : 0,
      round.correctAnswerLabel ?? round.answer,
      correct ? round.resultDetail : round.resultDetail ?? "次は読み勝ちましょう。",
    );
  }

  function handleStructuredAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!round || status !== "playing" || isTextAnswerRound(round)) {
      return;
    }

    if (round.answerFormat === "select" && !selectedAnswer) {
      setNotice({ tone: "error", text: "答えを選択してください。" });
      return;
    }

    if (round.answerFormat === "choice" && !selectedAnswer) {
      setNotice({ tone: "error", text: "答えを選択してください。" });
      return;
    }

    if (round.answerFormat === "dual-select" && (!dualAnswer.first || !dualAnswer.second)) {
      setNotice({ tone: "error", text: "上がる能力と下がる能力を選択してください。" });
      return;
    }

    const correct =
      round.answerFormat === "dual-select"
        ? isCorrectStructuredAnswer(round, dualAnswer.first, dualAnswer.second)
        : round.answerFormat === "choice"
          ? isCorrectStructuredAnswer(round, selectedAnswer)
        : isCorrectStructuredAnswer(round, selectedAnswer);

    finishRound(
      correct,
      correct ? 100 : 0,
      round.correctAnswerLabel ?? round.answer,
      correct ? round.resultDetail : round.resultDetail ?? "バトルの読み筋、もう一回磨けます。",
    );
  }

  function skipRound() {
    if (!round || status !== "playing") {
      return;
    }

    setTotalHints((current) => current + round.revealedHints);
    setStatus("answered");
    setNotice({ tone: "info", text: `答えは ${round.correctAnswerLabel ?? round.pokemon.displayNameJa} でした。` });
    setLastAnswer({
      correct: false,
      score: 0,
      answer: round.correctAnswerLabel ?? round.pokemon.displayNameJa,
      detail: round.resultDetail,
    });
    scrollToQuizTop();
  }

  function goNext() {
    if (questionNumber >= totalQuestions) {
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
    if (
      saved ||
      status !== "finished" ||
      !difficulty ||
      (difficulty === "professor" && !professorLevel) ||
      (difficulty === "trainer" && !trainerLevel) ||
      (difficulty === "silhouette" && !silhouetteLevel)
    ) {
      return;
    }

    const entry: RankingEntry = {
      difficulty,
      professorLevel: difficulty === "professor" ? professorLevel ?? undefined : undefined,
      trainerLevel: difficulty === "trainer" ? trainerLevel ?? undefined : undefined,
      silhouetteLevel: difficulty === "silhouette" ? silhouetteLevel ?? undefined : undefined,
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
          status === "idle" && "home-idle-shell",
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
          {isQuizActive && round && difficulty && (
            <div className="quiz-mobile-meta md:hidden">
              <div className="min-w-0">
                <p>QUESTION {questionNumber}</p>
                <h2>
                  {formatModeName(
                    difficulty,
                    round.professorLevel ?? professorLevel,
                    round.trainerLevel ?? trainerLevel,
                    round.silhouetteLevel ?? silhouetteLevel,
                  )}
                </h2>
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
                <p className="font-mono text-xl font-black">{questionNumber || 0}/{totalQuestions || 0}</p>
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
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
              <Panel className="p-5 md:p-7">
                <div className="mb-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">DIFFICULTY</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">レベルを選ぶ</h2>
                  </div>
                </div>
                <div className="generation-count" aria-live="polite">
                  <span>対象</span>
                  <strong>{candidateSpeciesIds.length}</strong>
                  <span>匹</span>
                </div>
                <GenerationSelector
                  isOpen={generationAccordionOpen}
                  onToggle={toggleGeneration}
                  onToggleOpen={() => setGenerationAccordionOpen((current) => !current)}
                  selectedIds={selectedGenerationIds}
                />
                <DifficultySelector
                  modePokemon={modePokemon}
                  selected={difficulty}
                  selectedProfessorLevel={professorLevel}
                  selectedSilhouetteLevel={silhouetteLevel}
                  selectedTrainerLevel={trainerLevel}
                  onSelect={handleDifficultySelect}
                  onSelectProfessorLevel={handleProfessorLevelSelect}
                  onSelectSilhouetteLevel={handleSilhouetteLevelSelect}
                  onSelectTrainerLevel={handleTrainerLevelSelect}
                />
              </Panel>
              <RankingPanel emptyText={rankingEmptyText} entries={activeRanking} modeLabel={activeRankingLabel} />
            </div>
            <UpdateNotes />
            <FutureIdeas />
          </>
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

        {(status === "playing" || status === "answered") && round && difficulty && (
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
                      {formatModeName(
                        difficulty,
                        round.professorLevel ?? professorLevel,
                        round.trainerLevel ?? trainerLevel,
                        round.silhouetteLevel ?? silhouetteLevel,
                      )}
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
                    <h3 className="text-xl font-black text-stone-950">
                      {isTextAnswerRound(round) ? "ヒント" : "問題情報"}
                    </h3>
                  </div>
                  <Eye aria-hidden className="text-[#5aa89c]" size={26} weight="bold" />
                </div>
                {round.prompt && (
                  <div className="quiz-prompt">
                    <p>{round.prompt.title}</p>
                    <strong>{round.prompt.body}</strong>
                    {round.prompt.detail && <span>{round.prompt.detail}</span>}
                  </div>
                )}
                <ClueList clues={currentClues} />
              </Panel>
            </div>

            <div className="quiz-visual-column space-y-4">
              {status === "answered" && lastAnswer && (
                <RoundResultBanner
                  actionIcon={questionNumber >= totalQuestions ? Trophy : Play}
                  actionLabel={questionNumber >= totalQuestions ? "結果を見る" : "次の問題"}
                  onAction={goNext}
                  result={lastAnswer}
                />
              )}

              <PokemonVisual
                revealColorImage={status === "answered" && round.difficulty !== "kids"}
                round={round}
              />

              {status === "playing" && (
                <AnswerForm
                  answer={answer}
                  dualAnswer={dualAnswer}
                  notice={notice}
                  onAnswerChange={setAnswer}
                  onChoiceAnswer={handleChoiceAnswer}
                  onDualAnswerChange={setDualAnswer}
                  onHint={handleHint}
                  onSelectedAnswerChange={setSelectedAnswer}
                  onSkip={skipRound}
                  onStructuredSubmit={handleStructuredAnswer}
                  onTextSubmit={handleAnswer}
                  round={round}
                  selectedAnswer={selectedAnswer}
                />
              )}
            </div>
          </div>
        )}

        {status === "finished" && difficulty && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
            <Panel className="p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a563c]">RESULT</p>
                  <h2 className="mt-3 text-4xl font-black leading-none tracking-tight text-stone-950 md:text-6xl">
                    {totalScore} / {totalQuestions * 100}
                  </h2>
                  <p className="mt-4 text-sm font-bold leading-6 text-stone-600">
                    {formatModeName(difficulty, professorLevel, trainerLevel, silhouetteLevel)}を完走しました。ヒント {totalHints} 回、
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
            <RankingPanel entries={activeRanking} modeLabel={activeModeName} />
          </div>
        )}
      </div>
      {status === "idle" && (
        <div className="home-start-dock">
          <div className="home-start-dock-inner">
            <div className="home-start-button-wrap">
              {startTooltipVisible && startDisabledReason && (
                <div className="home-start-tooltip" id="home-start-tooltip" role="tooltip">
                  {startDisabledReason}
                </div>
              )}
              <IconButton
                ariaDescribedBy={startTooltipVisible ? "home-start-tooltip" : undefined}
                ariaDisabled={!canStartGame}
                className="home-start-button"
                icon={Play}
                onClick={handleStartButtonClick}
                variant="cta"
              >
                クイズをはじめる
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
