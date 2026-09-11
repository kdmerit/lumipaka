# Stellar Rush 오디오 샘플

아군 전투기 기본 발사음 후보는 아래 두 파일만 유지합니다. 현재 게임에는 아직 연결하지 않았습니다.

| 파일 | 질감 | 길이 |
| --- | --- | ---: |
| `low-01-bass-plasma.wav` | 하강하는 베이스 플라즈마 펄스 | 290ms |
| `low-03-sub-bolt.wav` | 저음 타격감이 있는 볼트 | 340ms |

두 파일 모두 44.1kHz, mono, 16-bit PCM WAV입니다.

## 스테이지 클리어 승리음 후보

아래 파일은 스테이지 클리어 순간에 한 번 재생하기 위한 짧은 승리 음악 후보입니다. 아직 게임 코드에는 연결하지 않았습니다.

| 파일 | 분위기 |
| --- | --- |
| `victory-01-imperial-sunrise.wav` | 행진감 있는 장엄한 상승 팡파르 |
| `victory-02-cosmic-citadel.wav` | 낮은 음에서 치고 올라오는 우주 요새 테마 |
| `victory-03-aurora-crown.wav` | 밝고 강하게 절정으로 향하는 오로라 테마 |

모든 파일은 44.1kHz, mono, 16-bit PCM WAV입니다. 재생성 스크립트는 `games/stellar-rush/tools/generate-victory-samples.cjs`에 있습니다.
