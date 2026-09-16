# Stellar Rush 오디오 샘플

## 잡몹 격추음

`enemy_destroy.wav`는 사용자가 제공한 `bomb_explosion.wav`의 첫 0.3초를 추출하고 DC 오프셋 제거, 짧은 어택·지수 감쇠·끝 페이드로 다듬은 소형 폭발음이다. 48kHz stereo 16-bit PCM, 피크 -3.1dBFS이며 잡몹 격추당 gain 0.10으로 기존 컴프레서를 통해 재생한다. `player_destroy.wav`는 같은 원본의 저음과 잔향을 살린 1초 버전이며, 아군 전투기 목숨 감소 시 gain 0.20으로 한 번 재생한다. 두 샘플 모두 사운드 OFF 또는 로딩 실패 시 재생을 건너뛴다. 재생성 도구는 `games/stellar-rush/tools/render-enemy-explosion.py`와 `games/stellar-rush/tools/render-player-explosion-preview.cjs --grand`다.

## 시작 화면 로딩

아이템 PNG 6종은 긴 변 최대 256px의 투명 이미지로 배포합니다. 이미지 준비가 끝나면 시작 버튼을 활성화하며, WAV 로딩·디코딩은 백그라운드에서 계속합니다. 아직 준비되지 않은 효과음은 해당 재생을 건너뛰고 이후 정상 재생합니다.

## 효과음 원본 보관 위치

신규 효과음 원본은 Google Drive의 `codex/sound` 폴더에서 관리합니다. 사용자가 WAV 파일명을 지정하면 이 폴더에서 해당 파일을 먼저 확인하며, 적용을 지시받은 경우에만 이 디렉터리로 복사해 게임의 상대 경로 자산으로 사용합니다.

적용 효과음: `item_get2.wav`(모든 아이템 획득), `bomb_explosion.wav`(폭탄·보스 폭발), `victory-01-serene-spark.wav`(스테이지 클리어), 아래 보스 스킬 샘플.

## 보스 스킬 효과음

| 게임 자산 | Drive 원본 | 재생 시점 | gain |
| --- | --- | --- | ---: |
| `laser_prepare_3s.wav` | `LASER-PREPARE.wav`를 3초로 시간축 확장한 변환본 | 레이저포 충전 시작부터 3초 | 0.16 |
| `beam_fire_explosion.wav` | `BEAM-FIRE-EXPLOSION.wav` | 레이저포 발사 순간 1회 | 0.24 |
| `laser_spark.wav` | `LASERGUN-SPARK.wav` | 사이오닉 스톰 활성화 순간 1회 | 0.12 |
| `gun_fire.wav` | `GUN-FIRE.wav` | 속사포 탄환 한 발 생성마다 1회 | 0.07 |

속사포 샘플은 0.16초 발사 간격에 맞춰 중첩 재생하며 별도 디바운스나 발사 억제를 적용하지 않는다. 레이저 충전이 폭탄 등으로 취소되면 충전 샘플을 정리하고 빔 발사음은 재생하지 않는다. 원본 WAV는 Google Drive `codex/sound`에 보존하고 게임에는 상대 경로 복사본만 포함한다.

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
