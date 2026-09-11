# Stellar Rush 오디오 샘플

## 효과음 원본 보관 위치

신규 효과음 원본은 Google Drive의 `codex/sound` 폴더에서 관리합니다. 사용자가 WAV 파일명을 지정하면 이 폴더에서 해당 파일을 먼저 확인하며, 적용을 지시받은 경우에만 이 디렉터리로 복사해 게임의 상대 경로 자산으로 사용합니다.

적용 효과음: `item_get2.wav`(모든 아이템 획득), `bomb_explosion.wav`(폭탄·보스 폭발), `victory-01-serene-spark.wav`(스테이지 클리어).

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
| `victory-01-serene-spark.wav` | 하프와 현악으로 고요하게 시작해 플루트·첼레스타로 밝게 마무리되는 테마 |

파일은 약 5초 길이의 44.1kHz, stereo, 16-bit PCM WAV입니다. Virtual Playing Orchestra의 실제 현악·하프·플루트·첼레스타 샘플을 새 멜로디로 편곡한 결과물이며, 원본 샘플 파일은 배포하지 않습니다. 재생성 스크립트는 `games/stellar-rush/tools/render-vpo-victories.py`에 있습니다.
