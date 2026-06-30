export type CodexPanelAction =
  | "study-note"
  | "obsidian-canvas"
  | "context-map"
  | "revise-active"
  | "svg-sketch";

export type CodexPromptCategoryId = "md-template" | "dataview-visual" | "drawing-polish";

export interface CodexPromptCategory {
  id: CodexPromptCategoryId;
  label: string;
  emoji: string;
  icon: string;
  description: string;
}

export interface CodexPromptPreset {
  id: string;
  category: CodexPromptCategoryId;
  emoji: string;
  icon: string;
  label: string;
  kind: string;
  description: string;
  outputHint: string;
  instruction: string;
}

export const CODEX_PROMPT_CATEGORIES: CodexPromptCategory[] = [
  {
    id: "md-template",
    label: "MD 업무 템플릿",
    emoji: "📝",
    icon: "notebook-tabs",
    description: "회의, 규정, 업무노트, 보고서, 공지처럼 원문 Markdown을 업무 상황별 읽기 구조로 바꿉니다.",
  },
  {
    id: "dataview-visual",
    label: "DataviewJS · 시각화",
    emoji: "📊",
    icon: "layout-dashboard",
    description: "DataviewJS, HTML형 대시보드, 마인드맵, 타임라인처럼 독자가 탐색할 수 있는 시각 노트를 설계합니다.",
  },
  {
    id: "drawing-polish",
    label: "드로잉 · 논리 보정",
    emoji: "✍️",
    icon: "pen-line",
    description: "Excalidraw·Canvas 결과물을 더 읽기 쉽고 의미 있는 선생님 필기와 논리 구조로 다듬습니다.",
  },
];

export const CODEX_PROMPT_PRESETS: CodexPromptPreset[] = [
  {
    id: "meeting-note",
    category: "md-template",
    emoji: "🗣️",
    icon: "messages-square",
    label: "회의록",
    kind: "Markdown template",
    description: "회의 발언을 나열하지 않고 결정·쟁점·담당·검증 일정으로 재구성합니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 회의록 전용 Markdown 템플릿으로 재구성하라. 발언 순서가 아니라 `회의 목적 → 결정된 것 → 아직 열린 쟁점 → 근거/자료 → 담당자와 기한 → 다음 회의 전 검증` 흐름으로 정리하라. 발언자는 근거가 될 때만 남기고, 결론을 바꾸는 조건과 후속 액션을 표로 분리하라. 필요하면 Mermaid flowchart는 작고 읽기 쉬운 1개만 넣고, 회의 원문을 훼손하지 말고 사본에 적용하라.",
  },
  {
    id: "policy-note",
    category: "md-template",
    emoji: "📜",
    icon: "scroll-text",
    label: "규정·매뉴얼",
    kind: "Markdown template",
    description: "조항과 예외를 실행 체크리스트, 책임 경계, 위험 신호로 바꿉니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 규정/매뉴얼 전용 Markdown 템플릿으로 바꿔라. `적용 대상 → 반드시 해야 할 것 → 금지/주의 → 예외 조건 → 승인/증빙 → 위반 시 리스크 → 현장 체크리스트` 순서로 구성하라. 문구를 그대로 베끼지 말고 실제 사용자가 판단할 수 있는 조건문으로 풀어라. 애매한 조항은 `해석 필요` 박스로 따로 모으고, Mermaid는 의사결정 트리 1개 이하로 제한하라.",
  },
  {
    id: "daily-work-note",
    category: "md-template",
    emoji: "🧭",
    icon: "list-checks",
    label: "업무노트",
    kind: "Markdown template",
    description: "일일 기록을 업무 흐름, 병목, 다음 행동이 보이는 운영 노트로 정리합니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 업무노트 전용 Markdown 템플릿으로 정리하라. `오늘의 목표 → 처리한 일 → 막힌 지점 → 원인 가설 → 내일 첫 행동 → 확인해야 할 사람/자료 → 누적 리스크` 구조를 사용하라. 단순 일지 문장은 줄이고, 업무가 왜 지연/진전됐는지 보이는 원인-결과 문장으로 바꿔라. 반복 업무는 체크박스, 의사결정은 작은 표, 흐름은 짧은 Mermaid sequence 또는 flowchart로 표현하라.",
  },
  {
    id: "executive-report",
    category: "md-template",
    emoji: "📌",
    icon: "presentation",
    label: "보고서",
    kind: "Markdown template",
    description: "상위 보고용으로 결론, 근거, 리스크, 요청사항이 바로 보이게 만듭니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 보고서 전용 Markdown 템플릿으로 재작성하라. 첫 화면에 `한 문장 결론 → 숫자로 보는 변화 → 원인 3개 이하 → 리스크/불확실성 → 의사결정 요청 → 다음 보고 전 확인`이 보여야 한다. 숫자는 비교 기준과 기간을 붙이고, 과장된 표현은 제거하라. 표는 독자가 판단을 바꿀 수 있는 근거만 남기고, Mermaid는 원인-결과 흐름 1개만 사용하라.",
  },
  {
    id: "announcement",
    category: "md-template",
    emoji: "📣",
    icon: "megaphone",
    label: "공지사항",
    kind: "Markdown template",
    description: "공지문을 대상, 변경점, 해야 할 일, 문의 경로가 분명한 안내문으로 바꿉니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 공지사항 전용 Markdown 템플릿으로 바꿔라. `누가 읽어야 하는가 → 무엇이 바뀌는가 → 언제부터 적용되는가 → 사용자가 해야 할 일 → 하지 않으면 생기는 문제 → 문의/담당` 구조로 작성하라. 애매한 배경 설명보다 실행 문장을 우선하고, 중요도 높은 문장 3개를 상단 요약으로 올려라.",
  },
  {
    id: "project-status",
    category: "md-template",
    emoji: "🚦",
    icon: "kanban-square",
    label: "프로젝트 현황",
    kind: "Markdown template",
    description: "프로젝트를 일정·범위·리스크·의존성 중심의 상태판으로 재구성합니다.",
    outputHint: "원본 보호 사본 또는 지정 MD 템플릿 폴더",
    instruction:
      "현재 노트를 프로젝트 현황보고 템플릿으로 재구성하라. `현재 상태 신호등 → 이번 주 완료 → 지연/변경 → 의존성 → 의사결정 필요 → 다음 마일스톤 → 리스크 대응` 순서로 작성하라. 담당자, 날짜, 산출물을 표준화하고, Mermaid Gantt 또는 flowchart는 실제 일정/의존성이 있을 때만 1개 넣어라. 독자가 30초 안에 프로젝트가 정상/주의/위험인지 판단할 수 있게 하라.",
  },
  {
    id: "dataview-dashboard",
    category: "dataview-visual",
    emoji: "📈",
    icon: "layout-dashboard",
    label: "DataviewJS 대시보드",
    kind: "DataviewJS visual note",
    description: "노트 메타데이터와 본문 신호를 읽어 카드·표·상태 요약이 있는 대시보드 노트를 설계합니다.",
    outputHint: "DataviewJS/시각화 저장 폴더",
    instruction:
      "현재 노트와 관련 노트를 읽고 DataviewJS 전용 시각화 노트 설계를 작성하라. 산출물은 `요약 카드 → 상태 테이블 → 최근 변화 → 리스크/다음 액션` 구조를 가지며, 가능하면 DataviewJS 코드블록으로 구현한다. HTML/CSS를 쓰더라도 Obsidian 내부에서 깨지지 않는 범위로 제한하고, 필드가 없으면 어떤 YAML/인라인 필드를 추가해야 하는지 제안하라. 저장이 필요하면 지정된 DataviewJS/시각화 폴더 아래 새 노트로 생성하라.",
  },
  {
    id: "mindmap-note",
    category: "dataview-visual",
    emoji: "🧠",
    icon: "brain-circuit",
    label: "마인드맵",
    kind: "visual note",
    description: "복잡한 원문을 중심 개념, 가지, 반례, 질문이 있는 탐색형 마인드맵으로 바꿉니다.",
    outputHint: "DataviewJS/시각화 저장 폴더 또는 Excalidraw",
    instruction:
      "현재 노트를 마인드맵형 시각 노트로 설계하라. 중심 노드는 원문 제목이 아니라 독자가 이해해야 할 핵심 질문으로 잡고, 1차 가지는 `개념/근거/사례/반례/다음 질문`처럼 성격이 다른 축으로 나눠라. 단순 키워드 덩어리를 피하고 각 가지 끝에는 독자가 행동하거나 확인할 수 있는 문장을 둬라. Excalidraw가 적합하면 손글씨 마인드맵으로, Markdown이 적합하면 Mermaid mindmap 또는 목록형 트리로 제안하라.",
  },
  {
    id: "timeline-roadmap",
    category: "dataview-visual",
    emoji: "🗓️",
    icon: "calendar-range",
    label: "타임라인·로드맵",
    kind: "timeline visual",
    description: "흩어진 날짜, 단계, 의존성을 시간축과 마일스톤으로 정리합니다.",
    outputHint: "DataviewJS/시각화 저장 폴더",
    instruction:
      "현재 노트에서 날짜, 순서, 단계, 의존성을 추출해 타임라인/로드맵 시각화를 설계하라. `이미 지난 일 → 현재 병목 → 다음 2~3개 마일스톤 → 지연 시 영향 → 선행 조건`을 시간순으로 보여라. Mermaid timeline/gantt 또는 DataviewJS 표를 상황에 맞게 선택하고, 날짜가 불명확하면 추정하지 말고 `확인 필요`로 표시하라.",
  },
  {
    id: "risk-matrix",
    category: "dataview-visual",
    emoji: "🧯",
    icon: "shield-alert",
    label: "리스크 매트릭스",
    kind: "risk visual",
    description: "리스크를 영향도, 가능성, 감지 신호, 대응책으로 분해합니다.",
    outputHint: "DataviewJS/시각화 저장 폴더",
    instruction:
      "현재 노트의 문제, 우려, 불확실성을 리스크 매트릭스로 재구성하라. 각 리스크는 `증상 → 원인 가설 → 영향도 → 가능성 → 조기 경보 신호 → 대응책 → 책임자/기한`을 가져야 한다. 공포를 키우는 문장이 아니라 실제 관리 가능한 신호로 바꾸고, DataviewJS 표나 Markdown 표로 정렬 가능하게 설계하라.",
  },
  {
    id: "evidence-map",
    category: "dataview-visual",
    emoji: "🔎",
    icon: "git-branch-plus",
    label: "근거 지도",
    kind: "evidence map",
    description: "주장, 근거, 반례, 미확인 정보를 분리해 사고 품질을 높입니다.",
    outputHint: "Canvas 또는 DataviewJS/시각화 저장 폴더",
    instruction:
      "현재 노트를 근거 지도 형태로 재구성하라. 모든 주요 주장을 `주장 → 근거 → 반례/한계 → 확인 질문 → 결론에 미치는 영향`으로 분해하고, 근거가 없는 주장은 과감히 `미확인`으로 분리하라. Obsidian Canvas가 적합하면 파일 노드와 개념 노드를 연결하고, Markdown이 적합하면 표와 Mermaid flowchart를 조합하라.",
  },
  {
    id: "readability",
    category: "drawing-polish",
    emoji: "🔤",
    icon: "text-cursor-input",
    label: "가독성 정리",
    kind: "Excalidraw polish",
    description: "한글 손글씨 크기, 행간, 박스 여백을 키우고 겹침을 제거합니다.",
    outputHint: "현재 드로잉 또는 Excalidraw 저장 폴더",
    instruction:
      "한글 손글씨가 읽히도록 글자 크기와 행간을 키우고, 박스 안 여백을 충분히 확보하라. 긴 문장은 판단을 바꾸는 핵심 문장으로 줄이고, 겹친 선·텍스트·화살표를 모두 풀어라. 독자가 확대 없이 읽을 수 없으면 실패로 간주하고 다시 배치하라.",
  },
  {
    id: "teacher-board",
    category: "drawing-polish",
    emoji: "👩‍🏫",
    icon: "graduation-cap",
    label: "선생님 필기",
    kind: "Excalidraw study note",
    description: "교재를 칠판에 설명하듯 질문, 결론, 근거, 반례, 확인사항만 남깁니다.",
    outputHint: "현재 드로잉 또는 Excalidraw 저장 폴더",
    instruction:
      "교재를 읽고 칠판에 필기하는 선생님처럼 구성하라. 첫 줄은 핵심 질문, 중앙은 잠정 결론, 아래는 근거와 반례, 마지막은 다음 확인사항으로 둔다. 예쁜 장식보다 이해 흐름을 우선하고, 독자가 원문을 다시 보지 않아도 왜 그 결론인지 따라갈 수 있게 하라.",
  },
  {
    id: "decision-spine",
    category: "drawing-polish",
    emoji: "🧬",
    icon: "route",
    label: "논리 뼈대",
    kind: "logic diagram",
    description: "사실 나열을 결론을 바꾸는 원인·근거·불확실성·검증 흐름으로 압축합니다.",
    outputHint: "현재 드로잉 또는 Excalidraw 저장 폴더",
    instruction:
      "본문의 사실 나열을 그대로 옮기지 말고, 결론을 바꾸는 원인-근거-불확실성-검증 순서의 논리 뼈대로 다시 구성하라. 각 박스는 `왜 중요한가`가 드러나는 문장이어야 하며, 단순 항목 목록은 금지한다. 마지막에는 결론이 바뀌는 조건을 반드시 남겨라.",
  },
  {
    id: "whiteboard",
    category: "drawing-polish",
    emoji: "⚪",
    icon: "panel-top",
    label: "화이트보드",
    kind: "visual theme",
    description: "검은 마커, 파란 보조선, 빨간 주의만 쓰는 절제된 화이트보드로 바꿉니다.",
    outputHint: "현재 드로잉 또는 Excalidraw 저장 폴더",
    instruction:
      "화이트보드 테마로 전환하라. 검은 마커를 기본으로 쓰고, 파란색은 보조 흐름, 빨간색은 주의/반례에만 사용하라. 배경색과 채움색은 최대한 절제하고, 정보 위계는 색보다 위치와 선 굵기로 만든다.",
  },
  {
    id: "richer",
    category: "drawing-polish",
    emoji: "💎",
    icon: "gem",
    label: "내용 보강",
    kind: "insight polish",
    description: "누락된 판단 근거, 비교 기준, 조건부 결론, 다음 질문을 보강합니다.",
    outputHint: "현재 드로잉 또는 Excalidraw 저장 폴더",
    instruction:
      "누락된 의사결정 핵심 근거를 보강하라. 숫자, 비교 기준, 조건부 판단, 반례, 다음 확인 질문을 균형 있게 남겨라. 단, 원문에 없는 사실을 꾸며내지 말고 `추론`, `확인 필요`, `근거 있음`을 구분하라. 결과물은 더 화려한 것이 아니라 더 판단하기 쉬워야 한다.",
  },
];

export function getPromptCategory(id: CodexPromptCategoryId): CodexPromptCategory {
  return CODEX_PROMPT_CATEGORIES.find((category) => category.id === id) ?? CODEX_PROMPT_CATEGORIES[0];
}

export function firstPresetForCategory(categoryId: CodexPromptCategoryId): CodexPromptPreset {
  return CODEX_PROMPT_PRESETS.find((preset) => preset.category === categoryId) ?? CODEX_PROMPT_PRESETS[0];
}

export function actionLabel(action: CodexPanelAction): string {
  switch (action) {
    case "study-note":
      return "노트 한눈필기";
    case "obsidian-canvas":
      return "Obsidian Canvas";
    case "context-map":
      return "맥락 다이어그램";
    case "revise-active":
      return "현재 드로잉 수정";
    case "svg-sketch":
      return "SVG식 도식";
  }
}
