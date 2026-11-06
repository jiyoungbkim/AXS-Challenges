# 혹시요 — 분석 결과 JSON 스키마 v1.0

> 문서 목적: `혹시요`의 피드백 분석 결과를 프론트엔드와 백엔드가 동일한 구조로 주고받기 위한 데이터 명세입니다.
>
> 이 문서는 **출력 구조**를 정의합니다. 값을 채우는 판정 기준은 `analysis-rules.md`, 검증용 입력과 기대 결과는 `test-cases.md`를 따릅니다.
>
> 상태: **확정(구현 전)**. 이전에 `추가 결정 필요`였던 항목을 모두 결정했습니다. 결정 내용은 5장을 참고합니다.

## 1. 설계 원칙

1. 이번에 전달된 피드백에서 실제 수정 요청을 빠짐없이 추출합니다.
2. 한 문장에 여러 요청이 있으면 요청별 항목으로 분리합니다.
3. 하나의 요청이 여러 문장에 걸쳐 있으면 해당 문장들을 원문 순서대로 연결합니다.
4. 원문은 요약하거나 바꾸지 않고 보존합니다.
5. 이전 피드백은 현재 요청과 구분하며, 현재 요청의 해석을 돕는 참고자료로만 사용합니다.
6. 요구 주체(`requester`)는 전달자(`sender`)와 구분합니다. 근거가 없으면 추측하지 않습니다.
7. `confidence`와 `status`는 서로 독립적으로 판단합니다.
8. 확인이 필요한 항목에는 구체적인 확인 질문을 생성합니다.
9. **모든 원문 문장은 반드시 어딘가에 기록됩니다.** `items[].original_text`, `validation.non_request_text`, `validation.unmatched_text` 중 하나에 나타나야 합니다. (누락 검증)
10. **필드는 항상 존재합니다.** 값이 없으면 필드를 생략하지 않고 빈 배열(`[]`) 또는 `"unknown"`을 씁니다.

## 2. 최상위 구조

```json
{
  "schema_version": "1.0",
  "project": {},
  "feedback_context": {},
  "analysis": {},
  "items": [],
  "validation": {}
}
```

| 필드 | 자료형 | 설명 |
|---|---|---|
| `schema_version` | `string` | 스키마 버전. 현재 `"1.0"` |
| `project` | `object` | 프로젝트 정보 |
| `feedback_context` | `object` | 이번 피드백의 전달 맥락 |
| `analysis` | `object` | 입력 유형, 분석 요약, 항목 집계 |
| `items` | `array<object>` | 추출한 수정 요청 목록 |
| `validation` | `object` | 수정 요청이 아닌 문장, 연결하지 못한 문장, 부족한 정보, 참고 사항 |

## 3. 필드 상세

### 3.1 `project`

| 필드 | 자료형 | 설명 | 상태 |
|---|---|---|---|
| `name` | `string` | 프로젝트명. 입력 프로젝트 설명을 그대로 넣는다 | 필수 |

### 3.2 `feedback_context`

| 필드 | 자료형 | 허용값 / 설명 | 상태 |
|---|---|---|---|
| `channel` | `string` | `email`, `messenger`, `document`, `unknown` | 필수 |
| `sender` | `string` | 이번 피드백을 실제로 전달한 사람 또는 주체. 알 수 없으면 `"unknown"` | 필수 |

- `channel`과 `sender`는 입력의 프로젝트 설명 한 줄(예: `편집자 메일`)과 원문에서 **근거가 있을 때만** 채웁니다. 근거가 없으면 `unknown`입니다.
- `sender`는 피드백을 전달한 사람이고, `items[].requester`는 실제 수정 의견이나 요청을 낸 주체입니다. 두 값은 같을 수도 있고 다를 수도 있습니다.

### 3.3 `analysis`

| 필드 | 자료형 | 설명 | 상태 |
|---|---|---|---|
| `input_type` | `string` | `revision_feedback`, `no_revision_request`, `out_of_scope` | 필수 |
| `summary` | `string` | 이번 피드백의 핵심 내용을 한 문장으로 요약 | 필수 |
| `total_items` | `integer` | 추출된 전체 수정 요청 항목 수 | 필수 |
| `actionable_count` | `integer` | `status`가 `actionable`인 항목 수 | 필수 |
| `confirmation_count` | `integer` | `status`가 `needs_confirmation`인 항목 수 | 필수 |

`input_type`

| 값 | 의미 | `items` |
|---|---|---|
| `revision_feedback` | 수정 요청이 1개 이상 있는 피드백 | 1개 이상 |
| `no_revision_request` | 칭찬·감사·의견만 있고 수정 요청이 없음 | 빈 배열 |
| `out_of_scope` | 인사, 잡담, 견적·일정 문의 등 수정 피드백이 아님 | 빈 배열 |

- 수정 요청과 범위 밖 문장(견적 문의 등)이 섞여 있으면 `revision_feedback`입니다. 범위 밖 문장은 `non_request_text`에 넣습니다.

집계 규칙

- `total_items`는 `items.length`와 같아야 합니다.
- `actionable_count`는 `status = "actionable"`인 항목 수와 같아야 합니다.
- `confirmation_count`는 `status = "needs_confirmation"`인 항목 수와 같아야 합니다.
- `input_type`이 `revision_feedback`이 아니면 `items`는 빈 배열이고 세 집계값은 모두 `0`입니다.
- `summary`는 항상 채웁니다. 수정 요청이 없을 때는 `"수정 요청이 없는 피드백입니다."`, 범위 밖일 때는 `"수정 피드백이 아니어서 분석하지 않았습니다."`를 기본 문구로 씁니다.

### 3.4 `items[]`

각 항목은 하나의 독립적인 수정 요청을 나타냅니다. **모든 필드는 필수**입니다.

| 필드 | 자료형 | 허용값 / 설명 |
|---|---|---|
| `id` | `integer` | 결과 내 항목 식별 번호. 1부터 연속 |
| `original_text` | `string[]` | 해당 요청과 연결된 원문 문장. 원문 순서 유지 |
| `request` | `string` | 정리한 수정 요청 |
| `requester` | `string` | 실제 요청·의견을 낸 주체. 알 수 없으면 `"unknown"` |
| `requester_status` | `string` | `identified`, `unconfirmed` |
| `interpretations` | `string[]` | 가능한 해석 또는 수정 방향. 없으면 `[]` |
| `confidence` | `string` | `high`, `medium`, `low` |
| `confidence_reason` | `string` | 해당 확신도를 판단한 근거 |
| `status` | `string` | `actionable`, `needs_confirmation` |
| `prior_feedback_reference` | `string` | `matched`, `not_found`, `not_provided`, `not_applicable` |
| `questions` | `string[]` | 사용자에게 확인할 질문. 없으면 `[]` |

#### `original_text` 규칙

`original_text`는 **문자열 배열(`string[]`)**로 확정합니다.

- 요청 하나가 한 문장에 담겨 있으면 문장 하나를 배열에 넣습니다.
- 요청 하나가 여러 문장에 걸쳐 있으면 관련 문장들을 원문 순서대로 모두 넣습니다. 요청 문장 외에 이유·배경 문장, 요구 주체를 밝힌 문장도 포함합니다.
- 한 문장에 여러 요청이 포함되어 각각 분리되면, 각 항목에 같은 원문 문장을 연결합니다.
- 원문 문장을 요약·교정·재작성하지 않습니다.
- 문장 일부만 인용하지 않고 **문장 전체**를 보존합니다. 칭찬이나 유지 지시가 요청과 같은 문장에 있어도 문장을 쪼개지 않습니다.
- 문장 단위는 마침표·물음표·느낌표·줄바꿈 기준입니다. 쉼표로 이어진 절은 나누지 않습니다. 목록은 각 줄을 한 단위로 봅니다.
- 말줄임표(`...`, `…`)와 이모티콘은 문장 경계로 보지 않습니다. (예: `음... 다시 해주세요.`는 한 문장)
- 숫자와 숫자 사이의 마침표(`1.5배`, `0.8`)는 문장 경계로 보지 않습니다.

예시:

```json
{
  "original_text": [
    "마케팅팀에서 제목이 잘 보이지 않는다는 의견을 주셨습니다.",
    "제목이 조금 더 눈에 띄도록 수정 부탁드립니다."
  ],
  "request": "제목이 더 눈에 띄도록 개선"
}
```

#### `request` 규칙

- 의뢰인이 말한 **문제나 목표 수준**으로 씁니다. 해석을 하나로 단정하지 않습니다.
- 원문에 없는 수치, 색상, 구체적 방법을 만들어 넣지 않습니다.
- `confidence`가 `high`이고 수치나 방법이 원문에 명시되어 있을 때만 구체적으로 씁니다.

#### `requester`와 `requester_status`

- `requester`는 피드백을 전달한 사람(`feedback_context.sender`)과 구분합니다.
- 원문에 요청 주체가 명시되어 있으면 해당 주체를 기록하고 `identified`로 설정합니다. (예: `마케팅팀에서 ~ 해서요`)
- 제3자 언급 없이 **전달자 본인의 의견으로 읽히고** `sender`를 알고 있다면 `requester`를 `sender`와 같게 기록하고 `identified`로 설정합니다.
- 근거가 없으면 `"unknown"`과 `unconfirmed`를 사용합니다.
- `requester_status`가 `identified`이면 `requester`는 `"unknown"`이 아니고, `unconfirmed`이면 `"unknown"`입니다.
- 근거 없이 클라이언트·담당자 등을 추측하지 않습니다.

#### `interpretations`

- 원문만으로 수정 방향을 하나로 특정하기 어려울 때 가능한 해석을 기록합니다. 해석안은 **2~4개**로 제한합니다.
- 여러 방향이 가능한 경우 각 방향을 별도 문자열로 기록합니다.
- 해석이 하나로 좁혀지면 `[]`입니다. (대개 `high`)
- 수정 대상 자체를 특정할 수 없어 해석안을 만들 수 없으면 `[]`로 두고 `validation.missing_information`에 필요한 정보를 적습니다. (예: `여기 이 부분`)

#### `confidence`

`confidence`는 **원문의 의도와 수정 방향을 얼마나 명확하게 파악했는지**를 나타냅니다.

| 값 | 판정 기준 |
|---|---|
| `high` | 수정 대상, 의도, 방향이 명확하고 다른 해석의 여지가 거의 없음 |
| `medium` | 핵심 의도는 파악되지만 범위나 세부 방향 일부가 모호함 |
| `low` | 수정 대상이나 핵심 의도가 불명확하거나 가능한 해석이 여러 가지임 |

#### `status`

`status`는 **현재 정보로 작업을 시작해도 되는지**를 나타냅니다.

| 값 | 판정 기준 |
|---|---|
| `actionable` | 현재 피드백과 이전 맥락을 바탕으로 작업자가 합리적으로 판단해 진행할 수 있음 |
| `needs_confirmation` | 잘못 해석했을 때 결과 차이가 크거나 근거가 부족해 사전 확인이 필요함 |

`confidence`와 `status`는 별개입니다.

- `high`라고 항상 `actionable`인 것은 아닙니다.
- `medium`이라고 항상 `needs_confirmation`인 것도 아닙니다.
- 구체적인 수치나 방법이 없어도 작업자가 합리적으로 결정할 수 있으면 `actionable`일 수 있습니다.
- 이전 피드백과 현재 요청이 충돌하면 충돌 내용을 고려해 확인이 필요할 수 있습니다.
- `actionable`인데 `medium`이면 가정한 부분을 `confidence_reason`에 적습니다.

상세 판정 기준은 `analysis-rules.md` 4~5장을 따릅니다.

#### `prior_feedback_reference`

| 값 | 의미 |
|---|---|
| `matched` | 이전 피드백이 제공되었고, 현재 요청과 연결되는 내용을 찾음 |
| `not_found` | 이전 피드백이 제공되었지만 관련 내용을 찾지 못함 |
| `not_provided` | 현재 요청이 **이전 요청을 참조**하는데(`저번에 말씀드린 대로` 등) 이전 피드백이 제공되지 않음 |
| `not_applicable` | 현재 요청이 이전 피드백을 참조하지 않음 |

판정 순서:

1. 요청이 이전 피드백을 참조하지 않는다 → `not_applicable` (이전 피드백 제공 여부와 무관)
2. 참조하는데 이전 피드백이 없다 → `not_provided`
3. 참조하고 이전 피드백이 있으며 관련 내용을 찾았다 → `matched`
4. 참조하고 이전 피드백이 있으나 관련 내용이 없다 → `not_found`

이전 피드백은 현재 요청으로 새로 추출하지 않습니다. 해석 참고 및 충돌 확인에만 사용합니다.

#### `questions`

- `needs_confirmation` 항목에는 **1개 이상**의 구체적인 질문을 작성합니다.
- `actionable` 항목은 `[]`입니다. 가정한 내용은 질문이 아니라 `confidence_reason`에 적습니다.
- 질문은 가능한 해석이나 선택지를 구분할 수 있도록 작성합니다.
- 상세 작성 규칙은 `analysis-rules.md` 9장을 따릅니다.

### 3.5 `validation`

**모든 필드는 필수**이며, 내용이 없으면 `[]`입니다.

| 필드 | 자료형 | 설명 |
|---|---|---|
| `unmatched_text` | `string[]` | 수정 요청일 수 있으나 **항목으로 연결하지 못한** 원문 문장. 정상 결과에서는 비어 있어야 함 |
| `non_request_text` | `string[]` | 칭찬, 감사, 인사, 배경 설명, 범위 밖 문의, 독립된 유지 지시 등 **수정 요청이 아니라고 판단한** 원문 문장 |
| `missing_information` | `string[]` | 분석 또는 작업에 필요한데 제공되지 않은 정보 (이전 피드백, 시안 위치 등) |
| `notes` | `string[]` | 충돌, 해석상 주의점 등 추가 참고 사항 |

- `unmatched_text`와 `non_request_text`를 나눈 이유는 **누락 검증** 때문입니다. 칭찬 문장은 누락이 아니지만, 요청처럼 보이는데 연결하지 못한 문장은 누락 후보입니다.
- **독립 문장으로 된 유지 지시**(예: `의상은 지금 그대로 두세요.`)는 수정 요청이 아니므로 `non_request_text`에 넣습니다. 다만 작업할 때 지켜야 하는 조건이므로 `notes`에도 `유지 지시: <대상>`으로 기록합니다.
- 문장이 `items[].original_text`에 연결되어 있으면 `non_request_text`에 중복해서 넣지 않습니다.
- 이미지가 첨부된 입력은 `notes`에 "이미지는 분석하지 않았음"을 기록합니다.

## 4. 전체 예시

### 4.1 수정 요청이 있는 피드백 (T01)

프로젝트: `《밤의 정원》 표지, 편집자 메일`

> 표지 전체 분위기는 좋은데, 제목이 좀 묻히는 느낌이에요. 마케팅팀에서 좀 더 눈에 띄었으면 한다고 해서요. 그리고 저번에 말씀드린 대로 저자 이름은 조금 작게 가면 좋겠습니다.

```json
{
  "schema_version": "1.0",
  "project": {
    "name": "《밤의 정원》 표지, 편집자 메일"
  },
  "feedback_context": {
    "channel": "email",
    "sender": "편집자"
  },
  "analysis": {
    "input_type": "revision_feedback",
    "summary": "제목 가독성 개선과 저자 이름 크기 축소를 요청했으며, 두 항목 모두 확인이 필요함",
    "total_items": 2,
    "actionable_count": 0,
    "confirmation_count": 2
  },
  "items": [
    {
      "id": 1,
      "original_text": [
        "표지 전체 분위기는 좋은데, 제목이 좀 묻히는 느낌이에요.",
        "마케팅팀에서 좀 더 눈에 띄었으면 한다고 해서요."
      ],
      "request": "제목이 더 눈에 띄도록 개선",
      "requester": "마케팅팀",
      "requester_status": "identified",
      "interpretations": [
        "제목 크기 확대",
        "배경과 제목의 대비 강화",
        "제목 위치 변경",
        "제목 주변 배경 요소 단순화"
      ],
      "confidence": "low",
      "confidence_reason": "제목이 묻힌다는 문제는 명확하지만 원인이 특정되지 않았고 해결 방법이 여러 가지임",
      "status": "needs_confirmation",
      "prior_feedback_reference": "not_applicable",
      "questions": [
        "제목이 묻히는 이유가 크기 때문인가요, 아니면 배경과의 대비 때문인가요?",
        "마케팅팀에서 참고한 다른 표지나 원하는 디자인 방향이 있을까요?"
      ]
    },
    {
      "id": 2,
      "original_text": [
        "그리고 저번에 말씀드린 대로 저자 이름은 조금 작게 가면 좋겠습니다."
      ],
      "request": "저자 이름 크기 축소",
      "requester": "편집자",
      "requester_status": "identified",
      "interpretations": [
        "이전 요청에서 정한 크기나 기준에 맞춰 축소",
        "현재보다 소폭 축소"
      ],
      "confidence": "medium",
      "confidence_reason": "대상과 방향은 명확하지만 정도가 불명확하고, 이전 요청을 참조하는데 이전 피드백이 제공되지 않음",
      "status": "needs_confirmation",
      "prior_feedback_reference": "not_provided",
      "questions": [
        "저자 이름 축소는 지난번에 요청하셨던 내용과 같은 건가요?",
        "지난번에 말씀하신 크기나 기준이 있다면 다시 알려주실 수 있을까요?"
      ]
    }
  ],
  "validation": {
    "unmatched_text": [],
    "non_request_text": [],
    "missing_information": [
      "저자 이름에 대한 이전 피드백"
    ],
    "notes": []
  }
}
```

### 4.2 수정 요청이 없는 피드백 (T05)

> 시안 잘 받았습니다! 색감이 정말 마음에 들어요. 덕분에 팀 분위기도 좋아졌어요. 감사합니다.

```json
{
  "schema_version": "1.0",
  "project": {
    "name": "《밤의 정원》 표지, 편집자 메일"
  },
  "feedback_context": {
    "channel": "email",
    "sender": "편집자"
  },
  "analysis": {
    "input_type": "no_revision_request",
    "summary": "수정 요청이 없는 피드백입니다.",
    "total_items": 0,
    "actionable_count": 0,
    "confirmation_count": 0
  },
  "items": [],
  "validation": {
    "unmatched_text": [],
    "non_request_text": [
      "시안 잘 받았습니다!",
      "색감이 정말 마음에 들어요.",
      "덕분에 팀 분위기도 좋아졌어요.",
      "감사합니다."
    ],
    "missing_information": [],
    "notes": []
  }
}
```

## 5. 결정 사항

이전 초안의 `추가 결정 필요` 항목과 이번에 신설한 항목입니다. "필수 필드 고정, 빈 배열, `unknown` 처리" 원칙에 따라 모두 확정했습니다.

| 항목 | 결정 | 상태 |
|---|---|---|
| `feedback_context.sender` | 항상 필수. 모르면 `"unknown"` | 확정 |
| `interpretations` | 항상 포함. 해석이 하나로 좁혀지거나 대상을 특정할 수 없으면 `[]` | 확정 |
| `questions` | 항상 포함. `needs_confirmation`이면 1개 이상, `actionable`이면 `[]` | 확정 |
| `validation` 하위 필드 | 항상 포함. 내용이 없으면 `[]` | 확정 |
| 빈 `items`의 `summary` | `analysis.input_type`으로 구분하고 기본 문구 사용 (3.3 참조) | 확정 |
| `requester`의 `null` 허용 | 허용하지 않음. `"unknown"`만 사용 | 확정 |
| `original_text` 문장 분리 | 마침표·물음표·느낌표·줄바꿈 기준. 쉼표 절, 말줄임표, 이모티콘에서는 나누지 않음. 목록은 줄 단위. 숫자 사이의 마침표는 나누지 않음 | 확정 |
| **`analysis.input_type` 신설** | 칭찬만/범위 밖 입력을 프론트엔드가 구분할 수 있도록 추가 | 확정 (신규) |
| **`validation.non_request_text` 신설** | 칭찬 등 비요청 문장과 연결 실패 문장을 구분해 누락 검증 가능하게 함 | 확정 (신규) |
| **전달자 본인 의견의 `requester`** | 제3자 언급이 없고 `sender`를 알면 `sender`와 같게 `identified` 처리 | 확정 (신규) |
| `original_text` 확정 | `string[]` | 확정 |

### 향후 확장 후보 (이번 MVP 범위 밖)

- **`medium` + `actionable` 항목의 선택 질문**: 현재는 `actionable`이면 `questions`가 항상 `[]`이고 가정은 `confidence_reason`에 적습니다. 기획서 4-3의 "중간 확신도는 사용자가 되물을지 선택"을 더 충실히 지원하려면 선택 질문(0~1개)을 허용하는 방안이 있습니다. 이 경우 불변 조건 9번과 UI의 질문 표시 방식을 함께 바꿔야 합니다. 테스트 후 서윤이 중간 항목을 자주 되묻는 것으로 확인되면 도입합니다.

## 6. 구현 시 검증할 불변 조건

### 오류 (검증 실패 시 결과를 거부하거나 재시도)

1. `schema_version`은 `"1.0"`이어야 합니다.
2. `analysis.total_items === items.length`여야 합니다.
3. `analysis.actionable_count`와 `confirmation_count`는 각 `status` 항목 수와 같아야 합니다.
4. `analysis.input_type`이 `revision_feedback`이 아니면 `items`는 비어 있어야 하고, `revision_feedback`이면 1개 이상이어야 합니다.
5. 각 `items[].id`는 1부터 연속이며 중복되지 않아야 합니다.
6. 모든 enum 값은 이 문서에 정의된 허용값 중 하나여야 합니다.
7. 모든 필수 필드가 존재해야 합니다. 배열 필드를 생략하거나 `null`로 두지 않습니다.
8. `original_text`, `non_request_text`, `unmatched_text`의 각 문자열은 **입력 원문에 실제로 존재하는 문장**이어야 합니다. 이전 피드백의 문장이 들어가면 안 됩니다.
9. `status = needs_confirmation`이면 `questions.length >= 1`, `status = actionable`이면 `questions.length === 0`이어야 합니다.
10. `requester_status = identified`이면 `requester !== "unknown"`, `unconfirmed`이면 `requester === "unknown"`이어야 합니다.
11. 입력에 이전 피드백이 없으면 `matched`, `not_found`를 쓸 수 없고, 있으면 `not_provided`를 쓸 수 없습니다.
12. 입력 원문의 모든 문장은 `items[].original_text`, `non_request_text`, `unmatched_text` 중 하나에 나타나야 합니다.
13. 이전 피드백의 내용이 현재 `items`에 새로운 요청으로 섞이지 않아야 합니다.
14. `requester`를 확인할 근거가 없으면 추측하지 않아야 합니다.
15. `confidence`와 `status`를 하나의 규칙으로 자동 대응시키지 않아야 합니다.
16. 같은 문장이 `items[].original_text`와 `validation.non_request_text`에 동시에 나타나지 않아야 합니다.

### 경고 (오류는 아니지만 테스트에서 수동 검토)

- `confidence = low`인데 `status = actionable`인 항목
- `unmatched_text`가 비어 있지 않은 결과
- `interpretations`가 1개이거나 5개 이상인 항목 (규칙은 `[]` 또는 2~4개)
- `confidence = high`인데 `interpretations`가 비어 있지 않은 항목 (해석이 여럿이면 `high`가 아닐 가능성)
- `request`나 `interpretations`에 원문에 없는 숫자가 있는 항목

### 구현 권장

- `total_items`, `actionable_count`, `confirmation_count`는 LLM이 쓰게 하지 말고 **`items`에서 코드로 계산**해 채우면 집계 불일치 오류를 없앨 수 있습니다.
- 불변 조건 8, 12는 문자열 비교로 코드에서 검증할 수 있습니다. 비교 전에 공백과 따옴표를 정규화합니다. 검증에 실패하면 1회 재시도하는 방식을 권장합니다.
- 문장 복사 오류를 줄이려면 **코드가 원문을 먼저 문장 단위로 나누고 번호가 붙은 목록을 LLM에 전달**한 뒤, LLM은 번호로 연결하게 하는 방식도 쓸 수 있습니다. 스키마는 그대로이며, 구현 단계에서 모델 테스트 결과를 보고 결정합니다.

---

## 변경 이력

- v1.0 보완: 오류 조건 16, 원문에 없는 숫자 경고 추가
- v1.0 확정 (구현 반영): project.name 입력값 그대로 사용, 숫자 사이 마침표는 문장 경계 아님
- **v1.0 확정 (최종 검토 반영)**
  - 말줄임표·이모티콘을 문장 경계로 보지 않는 규칙 추가
  - 수정 요청과 범위 밖 문장이 섞인 경우의 `input_type` 규칙 추가
  - 독립 문장 유지 지시의 처리(`non_request_text` + `notes`) 추가
  - 4.1 예시에서 한 문자열에 질문 2개가 들어간 부분을 분리 (질문 규칙 "한 질문에 하나")
  - 불변 조건 8번을 `non_request_text`, `unmatched_text`까지 확대
  - 5장 표에서 떨어져 나간 `original_text` 확정 행을 표 안으로 복구
  - 경고에 `interpretations` 개수 조건 추가
- **v1.0 확정**: 5장의 모든 결정 사항을 확정. 선택 질문 허용은 향후 확장 후보로 분리.
- **v1.0 초안 (rev. 2)**
  - `analysis.input_type`, `validation.non_request_text` 추가
  - 모든 배열 필드를 필수로 확정하고 `[]` 규칙 명시
  - `requester` 판정 규칙과 `requester_status`와의 관계 명시
  - `prior_feedback_reference` 판정 순서 추가 (기존 예시에서 `not_applicable`이어야 할 항목에 `not_provided`를 쓴 불일치 수정)
  - 전체 예시를 T01로 교체 (기존 예시는 `summary`가 `저자 이름` 조정을 언급하지만 `items`에는 없었음)
  - `original_text`에 문장 분리 기준과 요청 외 문장(이유, 요구 주체) 포함 규칙 추가
  - `request` 작성 규칙(수치·색상 임의 생성 금지) 추가
  - 불변 조건을 오류/경고로 분리하고 항목 추가
  - 표를 파이프 표로 변환
- **v1.0 초안**: 기존 논의 내용을 문서화하고 `original_text`를 `string[]`로 확정.
