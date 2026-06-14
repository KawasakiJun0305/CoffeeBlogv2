// ---- Core Enums ----

export type Strategy = "topics" | "matrix" | "industry-matrix" | "news";

export type Category = "beans" | "brewing" | "cafe" | "equipment" | "culture" | "flavor" | "industry";

// ---- Data Files ----

/** data/topics.json の1エントリ */
export interface TopicEntry {
  topic: string;
  category: string;
}

/** data/topics-matrix.json のスキーマ */
export interface TopicsMatrix {
  beans: string[];
  methods: string[];
  angles: string[];
}

/** matrix 戦略で選択される1組み合わせ */
export interface MatrixCombo {
  bean: string;
  method: string;
  angle: string;
}

/** data/topics-industry-matrix.json のスキーマ */
export interface IndustryMatrix {
  companies: string[];
  angles: string[];
}

/** industry-matrix 戦略で選択される1組み合わせ */
export interface IndustryMatrixCombo {
  company: string;
  angle: string;
}

// ---- Generated History ----

interface GeneratedBase {
  strategy: Strategy;
  date: string; // YYYY-MM-DD
  file: string;
  noteUrl: string | null;
}

export interface GeneratedTopicsEntry extends GeneratedBase {
  strategy: "topics";
  topic: string;
  category: string;
}

export interface GeneratedMatrixEntry extends GeneratedBase {
  strategy: "matrix";
  bean: string;
  method: string;
  angle: string;
}

export interface GeneratedIndustryMatrixEntry extends GeneratedBase {
  strategy: "industry-matrix";
  company: string;
  angle: string;
  topic: string;
}

export interface GeneratedNewsEntry extends GeneratedBase {
  strategy: "news";
}

export type GeneratedEntry =
  | GeneratedTopicsEntry
  | GeneratedMatrixEntry
  | GeneratedIndustryMatrixEntry
  | GeneratedNewsEntry;

/** data/generated.json のルート */
export interface GeneratedHistory {
  generated: GeneratedEntry[];
}

// ---- Article Frontmatter ----

export interface ArticleFrontmatter {
  title: string;
  date: string; // YYYY-MM-DD
  category: Category;
  strategy: Strategy;
}

// ---- Scoring ----

export interface ArticleScore {
  titleHook: number;    // 0–25
  originality: number;  // 0–25
  concreteness: number; // 0–25
  readerFit: number;    // 0–25
  total: number;        // 0–100
}

export interface ScoringResult {
  file: string;
  score: ArticleScore;
  suggestions: string[];
}

// ---- Note Post ----

export interface NotePostResult {
  noteId: string;
  noteUrl: string;
}
