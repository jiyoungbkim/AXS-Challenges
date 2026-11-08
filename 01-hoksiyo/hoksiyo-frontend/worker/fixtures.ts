// Real /api/analyze responses from hoksiyo-backend/experiments/2026-11-08-integration,
// except T10 from 2026-11-08-revalidate (marked below)
// (docs/test-cases.md inputs), used by worker/mock.ts. reply_text and
// reply_metadata are kept on purpose: the proxy must strip them.
// Copied as is (minus the run script's _-prefixed fields); do not edit by hand.

export const CASE_FIXTURES: Record<string, { feedback: string; body: Record<string, unknown> }> = {
  "T01": {
    "feedback": "표지 전체 분위기는 좋은데, 제목이 좀 묻히는 느낌이에요. 마케팅팀에서 좀 더 눈에 띄었으면 한다고 해서요. 그리고 저번에 말씀드린 대로 저자 이름은 조금 작게 가면 좋겠습니다.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《밤의 정원》 표지"
        },
        "feedback_context": {
          "channel": "email",
          "sender": "편집자"
        },
        "analysis": {
          "input_type": "revision_feedback",
          "summary": "제목의 가시성 개선(마케팅팀 요구)과 저자 이름 크기 축소 요청이 있습니다.",
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
            "request": "제목이 묻히지 않고 좀 더 눈에 띄었으면 합니다.",
            "requester": "마케팅팀",
            "requester_status": "identified",
            "interpretations": [
              "제목 글자 크기 키우기",
              "제목 색상·대비 강화",
              "제목 주변 배경 정리"
            ],
            "confidence": "low",
            "confidence_reason": "제목이 묻히는 문제만 제시되고 구체적 수정 방법이 없어 해석이 여러 갈래입니다.",
            "status": "needs_confirmation",
            "prior_feedback_reference": "not_applicable",
            "questions": [
              "제목을 눈에 띄게 하려면 글자 크기 키우기와 색상·대비 조절 중 어느 방향으로 진행할까요?",
              "마케팅팀이 원하는 '눈에 띄는' 정도는 어느 정도인가요?"
            ]
          },
          {
            "id": 2,
            "original_text": [
              "그리고 저번에 말씀드린 대로 저자 이름은 조금 작게 가면 좋겠습니다."
            ],
            "request": "저자 이름을 조금 작게 해줬으면 합니다.",
            "requester": "편집자",
            "requester_status": "identified",
            "interpretations": [],
            "confidence": "medium",
            "confidence_reason": "저자 이름 축소라는 대상과 방향은 명확하지만 '조금'이라는 정도가 열려 있고, 이전 요청을 참조하나 이전 피드백이 없어 대조할 수 없습니다.",
            "status": "needs_confirmation",
            "prior_feedback_reference": "not_provided",
            "questions": [
              "저자 이름은 현재 크기에서 어느 정도 줄이면 될까요?",
              "저번에 말씀하신 구체적인 크기가 있다면 알려주실 수 있을까요?"
            ]
          }
        ],
        "validation": {
          "unmatched_text": [],
          "non_request_text": [],
          "missing_information": [
            "저자 이름 크기 관련 이전 피드백 내용"
          ],
          "notes": [
            "문장 1은 칭찬(분위기)과 제목 수정 요청이 같은 문장에 있어 분리하지 않고 요청 항목에 포함했습니다.",
            "문장 2는 마케팅팀이 요구 주체임을 밝힌 문장으로 제목 항목에 함께 넣었습니다."
          ]
        }
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [
              {
                "cond": 16,
                "message": "문장 1이 items의 original_text와 non_request_text에 동시에 있습니다."
              }
            ],
            "judgments": [
              {
                "confidence": "low",
                "status": "needs_confirmation"
              },
              {
                "confidence": "medium",
                "status": "needs_confirmation"
              }
            ]
          },
          {
            "n": 2,
            "errors": [],
            "judgments": [
              {
                "confidence": "low",
                "status": "needs_confirmation"
              },
              {
                "confidence": "medium",
                "status": "needs_confirmation"
              }
            ]
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 1278,
          "output": 1293,
          "cacheRead": 6144,
          "cacheWrite": 0,
          "totalTokens": 8715,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 9712
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 58,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 564,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 830,
        "basis": "measured",
        "daily_used": 4464,
        "daily_limit": 9000
      }
    }
  },
  "T05": {
    "feedback": "시안 잘 받았습니다! 색감이 정말 마음에 들어요. 덕분에 팀 분위기도 좋아졌어요. 감사합니다.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《밤의 정원》 표지"
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
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [],
            "judgments": []
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 2272,
          "output": 81,
          "cacheRead": 1024,
          "cacheWrite": 0,
          "totalTokens": 3377,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 3630
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 178,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 684,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 355,
        "basis": "measured",
        "daily_used": 355,
        "daily_limit": 9000
      }
    }
  },
  "T06": {
    "feedback": "안녕하세요, 혹시 다음 달에 삽화 10컷 작업도 가능하실까요? 대략 견적이 어느 정도 나올지 궁금합니다.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《밤의 정원》 표지"
        },
        "feedback_context": {
          "channel": "unknown",
          "sender": "unknown"
        },
        "analysis": {
          "input_type": "out_of_scope",
          "summary": "수정 피드백이 아니어서 분석하지 않았습니다.",
          "total_items": 0,
          "actionable_count": 0,
          "confirmation_count": 0
        },
        "items": [],
        "validation": {
          "unmatched_text": [],
          "non_request_text": [
            "안녕하세요, 혹시 다음 달에 삽화 10컷 작업도 가능하실까요?",
            "대략 견적이 어느 정도 나올지 궁금합니다."
          ],
          "missing_information": [],
          "notes": []
        }
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [],
            "judgments": []
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 364,
          "output": 79,
          "cacheRead": 2944,
          "cacheWrite": 0,
          "totalTokens": 3387,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 1374
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 75,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 581,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 153,
        "basis": "measured",
        "daily_used": 4617,
        "daily_limit": 9000
      }
    }
  },
  "T07": {
    "feedback": "음... 다시 해주세요.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《할머니의 여름》 삽화"
        },
        "feedback_context": {
          "channel": "messenger",
          "sender": "독립출판 작가"
        },
        "analysis": {
          "input_type": "revision_feedback",
          "summary": "무엇을 어떻게 고쳐야 하는지 구체적 지시 없이 전체 재작업을 요청하는 피드백입니다. 수정 대상과 방향을 특정할 수 없어 확인이 필요합니다.",
          "total_items": 1,
          "actionable_count": 0,
          "confirmation_count": 1
        },
        "items": [
          {
            "id": 1,
            "original_text": [
              "음... 다시 해주세요."
            ],
            "request": "구체적인 이유나 방향 없이 삽화를 다시 해 달라는 요청",
            "requester": "unknown",
            "requester_status": "unconfirmed",
            "interpretations": [],
            "confidence": "low",
            "confidence_reason": "수정 대상과 방향이 전혀 명시되지 않아 텍스트만으로는 해석이 여러 갈래이고 대상을 특정할 수 없습니다.",
            "status": "needs_confirmation",
            "prior_feedback_reference": "not_applicable",
            "questions": [
              "어떤 부분이 마음에 안 드시는지 구체적으로 알려주실 수 있을까요? (예: 구도, 캐릭터 표정, 색감, 분위기 등)",
              "삽화 전체를 새로 그려야 할까요, 아니면 특정 부분만 수정하면 될까요?"
            ]
          }
        ],
        "validation": {
          "unmatched_text": [],
          "non_request_text": [],
          "missing_information": [
            "어떤 부분을 고쳐야 하는지에 대한 구체적 지시",
            "재작업의 범위(전체 삽화인지 특정 장면인지)",
            "수정 방향(구도, 표정, 색감 등)에 대한 의견"
          ],
          "notes": []
        }
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [],
            "judgments": [
              {
                "confidence": "low",
                "status": "needs_confirmation"
              }
            ]
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 282,
          "output": 406,
          "cacheRead": 2944,
          "cacheWrite": 0,
          "totalTokens": 3632,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 2291
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 75,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 581,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 273,
        "basis": "measured",
        "daily_used": 5712,
        "daily_limit": 9000
      }
    }
  },
  "T09": {
    "feedback": "저번에 말씀드린 대로 저자 이름은 작게 부탁드려요.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《밤의 정원》 표지"
        },
        "feedback_context": {
          "channel": "email",
          "sender": "편집자"
        },
        "analysis": {
          "input_type": "revision_feedback",
          "summary": "이전 피드백을 참조하며 저자 이름을 작게 해달라는 수정 요청입니다. 이전 피드백에서 저자 이름 크기 관련 지적을 확인할 수 있어 일치합니다.",
          "total_items": 1,
          "actionable_count": 1,
          "confirmation_count": 0
        },
        "items": [
          {
            "id": 1,
            "original_text": [
              "저번에 말씀드린 대로 저자 이름은 작게 부탁드려요."
            ],
            "request": "저자 이름을 이전 피드백에서 언급된 것처럼 눈에 띄지 않도록 줄여달라",
            "requester": "편집자",
            "requester_status": "identified",
            "interpretations": [],
            "confidence": "medium",
            "confidence_reason": "저자 이름이라는 대상과 축소라는 방향은 이전 피드백과의 대조로 명확하지만, 구체적인 크기나 정도는 열려 있어 소폭 축소로 가정합니다.",
            "status": "actionable",
            "prior_feedback_reference": "matched",
            "questions": []
          }
        ],
        "validation": {
          "unmatched_text": [],
          "non_request_text": [],
          "missing_information": [],
          "notes": []
        }
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [],
            "judgments": [
              {
                "confidence": "medium",
                "status": "actionable"
              }
            ]
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 271,
          "output": 330,
          "cacheRead": 3008,
          "cacheWrite": 0,
          "totalTokens": 3609,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 2377
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 91,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 597,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 244,
        "basis": "measured",
        "daily_used": 5240,
        "daily_limit": 9000
      }
    }
  },
  // T10: hoksiyo-backend/experiments/2026-11-08-revalidate/T10.json
  "T10": {
    "feedback": "주인공 머리색을 좀 더 밝게 해주시고, 1장 삽화 말풍선 글씨는 키워주세요. 모바일에서 보면 너무 작아서 안 읽혀요. 의상은 지금 노란 원피스 그대로 두세요.",
    "body": {
      "analysis": {
        "schema_version": "1.0",
        "project": {
          "name": "《할머니의 여름》 삽화"
        },
        "feedback_context": {
          "channel": "messenger",
          "sender": "독립출판 작가"
        },
        "analysis": {
          "input_type": "revision_feedback",
          "summary": "주인공 머리색을 밝게 할 것과 1장 말풍선 글씨 크기 확대 요청이 있고, 의상은 유지 지시입니다.",
          "total_items": 2,
          "actionable_count": 2,
          "confirmation_count": 0
        },
        "items": [
          {
            "id": 1,
            "original_text": [
              "주인공 머리색을 좀 더 밝게 해주시고, 1장 삽화 말풍선 글씨는 키워주세요."
            ],
            "request": "주인공 머리색을 지금보다 밝게 조정해 달라는 요청입니다.",
            "requester": "독립출판 작가",
            "requester_status": "identified",
            "interpretations": [],
            "confidence": "medium",
            "confidence_reason": "수정 대상(주인공 머리색)은 명확하지만 '좀 더 밝게'라는 정도와 색상 값이 열려 있어 있습니다.",
            "status": "actionable",
            "prior_feedback_reference": "not_applicable",
            "questions": []
          },
          {
            "id": 2,
            "original_text": [
              "주인공 머리색을 좀 더 밝게 해주시고, 1장 삽화 말풍선 글씨는 키워주세요.",
              "모바일에서 보면 너무 작아서 안 읽혀요."
            ],
            "request": "1장 삽화 말풍선 글씨를 키워달라는 요청으로, 모바일에서 읽을 수 있는 크기가 목표입니다.",
            "requester": "독립출판 작가",
            "requester_status": "identified",
            "interpretations": [],
            "confidence": "medium",
            "confidence_reason": "대상(1장 말풍선 글씨)과 방향(확대)은 명확하지만 목표 크기가 제시되지 않아 정도가 열려 있습니다. 모바일에서 읽히는 수준까지 소폭 이상 확대로 가정합니다.",
            "status": "actionable",
            "prior_feedback_reference": "not_applicable",
            "questions": []
          }
        ],
        "validation": {
          "unmatched_text": [],
          "non_request_text": [
            "의상은 지금 노란 원피스 그대로 두세요."
          ],
          "missing_information": [],
          "notes": [
            "유지 지시: 주인공 의상(노란 원피스)"
          ]
        }
      },
      "meta": {
        "mode": "C",
        "model": "@cf/zai-org/glm-5.3",
        "thinking": "low",
        "attempts": [
          {
            "n": 1,
            "errors": [],
            "judgments": [
              {
                "confidence": "medium",
                "status": "actionable"
              },
              {
                "confidence": "medium",
                "status": "actionable"
              }
            ]
          }
        ],
        "final_errors": [],
        "warnings": [],
        "outcome": "finished",
        "usage": {
          "input": 1128,
          "output": 443,
          "cacheRead": 2240,
          "cacheWrite": 0,
          "totalTokens": 3811,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        },
        "duration_ms": 4711
      },
      "reply_text": "완료",
      "reply_metadata": {
        "response_usage": {
          "input": 506,
          "output": 90,
          "cacheRead": 0,
          "cacheWrite": 0,
          "totalTokens": 596,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0,
            "total": 0
          }
        }
      },
      "usage": {
        "neurons": 380,
        "basis": "measured",
        "daily_used": 2325,
        "daily_limit": 9000
      }
    }
  }
};
