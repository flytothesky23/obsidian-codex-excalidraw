export type CodexPanelAction =
  | "study-note"
  | "context-map"
  | "revise-active"
  | "svg-sketch";

export interface CodexPromptPreset {
  id: string;
  label: string;
  instruction: string;
}

export const CODEX_PROMPT_PRESETS: CodexPromptPreset[] = [
  {
    id: "readability",
    label: "가독성 정리",
    instruction:
      "한글 손글씨가 읽히도록 글자 크기와 행간을 키우고, 박스 안 여백을 넓혀라. 긴 문장은 핵심 판단 문장으로 줄여라.",
  },
  {
    id: "teacher-board",
    label: "선생님 필기",
    instruction:
      "교재를 읽고 칠판에 필기하는 선생님처럼 질문, 잠정 결론, 근거, 반례, 다음 확인사항만 남겨라. 장식보다 이해 흐름을 우선하라.",
  },
  {
    id: "decision-spine",
    label: "논리 뼈대",
    instruction:
      "본문의 사실 나열을 그대로 옮기지 말고, 결론을 바꾸는 원인-근거-불확실성-검증 순서의 논리 뼈대로 다시 구성하라.",
  },
  {
    id: "whiteboard",
    label: "화이트보드",
    instruction:
      "화이트보드 테마로 전환하고 검은 마커, 파란 보조선, 빨간 주의 표시만 사용하라. 배경색과 채움색은 최대한 절제하라.",
  },
  {
    id: "compact",
    label: "핵심만",
    instruction:
      "다이어그램 전체 문장을 줄이고 중복을 제거하라. 독자가 30초 안에 질문, 결론, 확인할 리스크를 파악하게 만들어라.",
  },
  {
    id: "richer",
    label: "내용 보강",
    instruction:
      "누락된 의사결정 핵심 근거를 보강하라. 숫자, 비교 기준, 조건부 판단, 다음 주 확인 질문을 균형 있게 남겨라.",
  },
];

export function actionLabel(action: CodexPanelAction): string {
  switch (action) {
    case "study-note":
      return "노트 한눈필기";
    case "context-map":
      return "맥락 다이어그램";
    case "revise-active":
      return "현재 드로잉 수정";
    case "svg-sketch":
      return "SVG식 도식";
  }
}
