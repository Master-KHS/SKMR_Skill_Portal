from pathlib import Path

from pptxtpl.PptxDocument import PptxDocument


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "AI Boot Camp 가이드 PPT 양식 jinna2.pptx"
OUTPUT = ROOT / "AI Boot Camp 가이드 PPT 생성본.pptx"


def block(*lines: str) -> str:
    return "\n".join(lines)


data = {
    "input1": "SKMR Skill Portal",
    "input2": block(
        "직원 스킬 진단, 평가, 확정 흐름을 한 화면에서 관리하는 HR 포털",
        "자가/리더/Calibration/Committee 단계를 권한 기반으로 연결",
        "스킬 프로필과 이력, 결과물을 함께 조회할 수 있도록 구성",
    ),
    "input3": block(
        "평가 기준과 판단 이력이 분산되어 운영 일관성이 떨어지는 문제가 있음",
        "리더·Calibration·Committee가 같은 기준을 공유해야 재작업을 줄일 수 있음",
        "결과를 축적해 다음 평가와 인재 검색에 재활용할 필요가 있음",
    ),
    "input4": block(
        "대상자 검색 후 스킬 프로필과 평가 이력을 즉시 확인",
        "단계별 평가와 확정을 거쳐 결과가 반영되는 흐름 시연",
        "대시보드에서 진행률, 분포, 리스크를 함께 확인",
    ),
    "input5": block(
        "권한별 API 검증으로 단계별 평가와 확정 절차를 분리",
        "자기평가, 리더평가, Calibration, Committee를 순차적으로 연결",
        "상태와 이력이 저장되어 재조회와 재현이 가능한 구조",
    ),
    "input6": block(
        "실제 HR 운영 단위인 개인, 팀, 본부 기준으로 화면과 권한을 나눔",
        "평가자와 피평가자의 관계를 반영해 업무 흐름을 자연스럽게 맞춤",
        "검색, 평가, 리포트가 한 시스템 안에서 이어져 활용성이 높음",
    ),
    "input7": block(
        "새로운 평가 항목이나 역할이 추가돼도 동일한 구조로 확장 가능",
        "스킬 마스터, 평가선, 리포트 화면을 분리해 유지보수성을 확보",
        "데이터와 UI를 분리해 향후 조직 확대에도 대응하기 쉬움",
    ),
    "input8": block(
        "권한 기반 접근 제어를 서버/API 단에서 함께 적용",
        "평가 단계별 상태 전이를 관리해 임의 수정 가능성을 줄임",
        "운영 데이터와 참고 데이터를 분리해 추적성과 안정성을 높임",
    ),
}


def main() -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE}")

    doc = PptxDocument(str(TEMPLATE), data)
    doc.render()
    doc.save(str(OUTPUT))
    print(f"saved: {OUTPUT}")


if __name__ == "__main__":
    main()
