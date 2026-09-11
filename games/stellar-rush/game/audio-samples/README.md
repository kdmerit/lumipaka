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
| `victory-01-neon-fanfare.wav` | 빠르고 밝은 네온 팡파르 |
| `victory-02-starlight-ascent.wav` | 위로 치고 올라가는 별빛 멜로디 |
| `victory-03-comet-parade.wav` | 경쾌하고 리듬감 있는 혜성 퍼레이드 |
| `victory-04-orbit-triumph.wav` | 묵직하게 마무리되는 궤도 승리 테마 |
| `victory-05-galactic-crown.wav` | 최종 스테이지에도 어울리는 웅장한 상승 테마 |

모든 파일은 44.1kHz, mono, 16-bit PCM WAV입니다. 재생성 스크립트는 `games/stellar-rush/tools/generate-victory-samples.cjs`에 있습니다.
