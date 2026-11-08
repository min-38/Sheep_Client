# Credits

게임에 넣은 외부 에셋의 출처와 라이선스임. 쓰는 파일만 repo에 넣음 (기술 설계서 렌더링 에셋).

| 파일 | 원본 | 만든 사람 | 라이선스 | 받은 곳 |
| --- | --- | --- | --- | --- |
| `src/assets/revolver-rig.json` | Loafbrr 리볼버 팩의 `GLTF/RevolverExport.gltf`와 `Textures/Revolver_1/Revolver_1_Albedo.png`에서 뽑음. 총 부품·총알 메시, 뼈, 애니메이션(Reload, Shoot 첫 발을 자른 공이치기 당기기·발사)과 알베도 텍스처에서 면마다 구운 색만 남김 | Loafbrr | [CC BY 1.0](https://creativecommons.org/licenses/by/1.0/) | https://loafbrr.itch.io/ |
| `src/assets/audio/shot.mp3` | Snake's SECOND Authentic Gun Sounds Pack의 `Full Sounds/9mm/MP3/9mm Single.mp3` (이름만 바꿈) | f8studios ("Snake") | 퍼블릭 도메인 (작가가 밝힘) | https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack |
| `src/assets/audio/load.mp3` | Snake's SECOND Authentic Gun Sounds Pack의 `& More/Revolver/44 Magnum/MP3/44 Magnum Single Load.mp3` (이름만 바꿈) | f8studios ("Snake") | 퍼블릭 도메인 (작가가 밝힘) | https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack |
| `src/assets/audio/close-cylinder.mp3` | Snake's SECOND Authentic Gun Sounds Pack의 `& More/Revolver/44 Magnum/MP3/44 Magnum Close Cylinder.mp3` (이름만 바꿈) | f8studios ("Snake") | 퍼블릭 도메인 (작가가 밝힘) | https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack |
| `src/assets/audio/cock-hammer.mp3` | Snake's SECOND Authentic Gun Sounds Pack의 `& More/Revolver/44 Magnum/MP3/44 Magnum Cock Hammer.mp3` (이름만 바꿈) | f8studios ("Snake") | 퍼블릭 도메인 (작가가 밝힘) | https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack |
| `src/assets/audio/dry-fire.mp3` | Snake's SECOND Authentic Gun Sounds Pack의 `& More/Pistol/MP3/9mm Pistol Dry Fire.mp3` (이름만 바꿈) | f8studios ("Snake") | 퍼블릭 도메인 (작가가 밝힘) | https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack |
| `src/assets/audio/last-one-standing.mp3` | 사용자가 Suno로 만든 곡 `Last One Standing`. wav를 mp3(VBR, ffmpeg `libmp3lame -q:a 5`)로 줄임 | 사용자 (Suno로 만듦) | 사용자가 Suno 약관을 확인하고 넣기로 함 (2026-11-09) | 사용자가 줌 |
| `src/assets/audio/dusty-saloon.mp3` | 사용자가 Suno로 만든 곡 `Dusty Saloon`. wav를 mp3(VBR, ffmpeg `libmp3lame -q:a 5`)로 줄임 | 사용자 (Suno로 만듦) | 사용자가 Suno 약관을 확인하고 넣기로 함 (2026-11-09) | 사용자가 줌 |
| `src/assets/audio/high-noon-standoff.mp3` | 사용자가 Suno로 만든 곡 `High Noon Standoff`. wav를 mp3(VBR, ffmpeg `libmp3lame -q:a 5`)로 줄임 | 사용자 (Suno로 만듦) | 사용자가 Suno 약관을 확인하고 넣기로 함 (2026-11-09) | 사용자가 줌 |
| `src/assets/fonts/Rye-Regular.ttf` | Google Fonts의 Rye (`ofl/rye/Rye-Regular.ttf`). 이름이 지켜진 글꼴(Reserved Font Name "Rye")이라 고치지 않은 원본 그대로 넣음. 라이선스 전문은 `src/assets/fonts/Rye-OFL.txt` | Sorkin Type Co | [SIL OFL 1.1](https://openfontlicense.org) | https://github.com/google/fonts/tree/main/ofl/rye |
| `src/assets/fonts/black-han-sans.woff2` | Google Fonts의 Black Han Sans (`ofl/blackhansans/BlackHanSans-Regular.ttf`)에서 영문·숫자·기호, 한글 호환 자모, 완성형 한글, `·→…`만 남겨 woff2로 바꿈 (fonttools `pyftsubset`). 라이선스 전문은 `src/assets/fonts/BlackHanSans-OFL.txt` | The Black Han Sans Project Authors (Zess Type) | [SIL OFL 1.1](https://openfontlicense.org) | https://github.com/google/fonts/tree/main/ofl/blackhansans |
