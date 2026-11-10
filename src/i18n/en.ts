// 게임 안 문구의 원본 (CLAUDE.md Client copy). 다른 언어 파일은 이 꼴(Copy)을 그대로 채워야 빌드가 됨.
// 키는 화면별로 묶음. 값을 넣어야 하는 문구는 함수. ponytail: 임시 문구. 게임 안 문구 말투가 정해지면 다시 씀
export const en = {
  // 설정의 언어 목록에 보이는 이름. 언어마다 그 언어로 씀
  languageName: 'English',
  // 모든 언어에서 같은 영어 제목 (사용자 결정 2026-11-09)
  title: 'The Quick, the Slow and the Shot!',
  // 첫 화면 제목을 세 줄로 나눈 것. 줄마다 오른쪽으로 들여 씀 (SHEEP-111). 브라우저 탭 제목은 위 한 줄
  titleLines: ['The Quick,', 'the Slow', 'and the Shot!'],
  // 결투 화면
  hud: {
    screen: 'Game screen',
    hitCard: 'My shot result',
    ammo: (n: number) => `Bullets left: ${n}`,
    timer: 'Time left',
    alive: 'Players left',
    aliveCount: (n: number) => `${n} left`,
    banner: 'Round signal',
    watching: 'Player you are watching',
    watchingWho: (name: string) => `Watching ${name}`,
    replayWho: (name: string) => `Replay: ${name}`,
    replay: 'Replay',
    leave: 'Leave',
    roomCode: 'Room code',
    // 내가 쓰러졌을 때 가운데에 띄움
    down: "You're down",
    // "시작!" 신호
    go: 'Draw!',
    win: 'You win!',
    lose: 'You lose',
    rematch: (n: number) => `Rematch: ${n} players`,
    // 내 사격 결과 카드의 도장
    head: 'Headshot',
    wounded: 'Wounded',
    hitDown: 'Down',
    miss: 'Miss',
    // 쓰러지는 장면의 자막 카드 (SHEEP-119). 서부 사투리 말투 (CLAUDE.md Language)
    killCard: 'Who brought you down',
    downedBy: 'Downed by',
    outtaTime: 'Outta time',
    killLine: {
      head: (name: string) => `${name}'s bullet found your hat, partner.`,
      body: (name: string) => `${name}'s second slug laid you low, partner.`,
      timeout: 'Ran plumb outta time, partner.',
    },
  },
  // 술집 대기실과 판 끝 포스터
  saloon: {
    seats: 'People at the bar',
    board: 'Room',
    private: 'Private',
    leave: 'Leave',
    ready: 'Ready',
    unready: 'Unready',
    readyCount: (ready: number, total: number) => `Ready ${ready}/${total}`,
    settings: 'Settings',
    mySeat: 'My seat',
    // 좌석 꼬리표의 칼자국 눈금이 뜻하는 이긴 횟수
    wins: (n: number) => `${n} win${n === 1 ? '' : 's'}`,
    // 칠판의 방 코드 복사 (SHEEP-114). 서부 사투리 말투 (CLAUDE.md Language)
    copyCode: 'Copy room code',
    copied: 'Copied, partner',
    // 클립보드가 막혀 코드를 선택해 둠. keys는 Ctrl+C 또는 ⌘C
    copyFailed: (keys: string) => `Press ${keys}, partner`,
    readyStamp: 'Ready',
    winStamp: 'Winner',
    // 왼쪽 벽 현상금 게시판의 캐릭터·색 바꾸기 (SHEEP-118). keyParts는 캐릭터 번호 순서의 핵심 파츠 이름, colors는 사람 색 번호 순서의 색 이름
    wardrobe: 'Character and color',
    keyParts: ['Neckerchief', 'Sombrero', 'Shirt', 'Corset', 'Waistcoat', 'Coat', 'Hat', 'Poncho'],
    partColor: (part: string) => `${part} color`,
    colors: ['Red', 'Sky blue', 'Green', 'Yellow', 'Orange', 'Pink', 'White', 'Black'],
    // 방 안 다른 사람이 쓰는 색. 서부 사투리 말투 (CLAUDE.md Language)
    colorTaken: (color: string) => `${color}, spoken for`,
    // 술집 주인 말풍선 (SHEEP-116). 팁은 지금 규칙(시스템 기획서)을 알려 주고, 농담은 쓸데없는 말. 서부 사투리 말투 (CLAUDE.md Language)
    bartender: {
      tips: [
        "Hold that iron still a spell 'fore you shoot. Shaky hands miss, partner.",
        "Spin 'round fast and your aim'll wobble somethin' fierce. Let it settle.",
        "One bullet a round. Reckon you'd best make it count.",
        "Hit a man in the head, he's done. Gut him once, he's still standin'. Twice, he ain't.",
        `Ten seconds after "Draw!", partner. Dawdle past that and you'll do the undertaker's job yourself.`,
        "Click while you're walkin' and you'll stop short. Just the once, mind.",
        'Two fellers drop at once? Reckon they stand up and go again.',
        "Get shot and you can still watch through the eyes of them standin'. Click to switch.",
      ],
      jokes: [
        'Feller paid his tab with a bullet once. Reckon it went right through.',
        'Ten paces. One bullet. No refunds.',
        "Piano player ain't paid to duck.",
        'Last feller who drew early still owes me for his whiskey.',
        'Undertaker drinks free here. Good for business, his and mine.',
        "Feller once asked me for milk. Ain't seen him since.",
      ],
    },
  },
  // 첫 화면
  lobby: {
    nickname: 'Nickname',
    nicknameRule: '2–8 characters',
    ok: 'OK',
    // 캐릭터 번호 순서 (시스템 기획서 캐릭터 목록)
    characterNames: ['Charles', 'Rosa', 'Silas', 'Belle', 'Clayton', 'Jesse', 'Kate', 'Diego'],
    roomList: 'Room list',
    code: 'Room code',
    join: 'Join',
    // 첫 화면 메뉴와 입장 게시판 (시스템 기획서 방 화면 M8 첫 화면). 연습은 아직 없어 막아 둠
    play: 'Play',
    practice: 'Practice',
    rooms: 'Rooms',
    back: 'Back',
    doubleClick: 'Double-click a room to join',
    create: 'Create room',
    settings: 'Settings',
    connecting: 'Connecting to the server…',
    disconnected: 'Disconnected from the server. Refresh the page to reconnect.',
    // 같은 브라우저의 다른 탭이 이미 접속해 있을 때 (시스템 기획서 방 화면 탭 하나만)
    otherTab: 'The game is already open in another tab. Close that tab, then refresh this page.',
    noRooms: 'No open rooms',
    // 방 목록 한 줄에 3명까지 적고 나머지는 수만 (시스템 기획서 방 화면 대기실 보기)
    members: (names: string, more: number) => `${names} and ${more} more`,
    playing: 'In a match',
    full: 'Full',
    waiting: 'Waiting',
    // 서버가 입장을 거절한 사유 (기술 설계서 메시지 error)
    reasons: {
      notFound: 'No room with that code',
      full: 'That room is full',
      playing: 'A match is already on in that room',
      nickname: "That nickname doesn't fit the rules",
      roomName: "That room name doesn't fit the rules",
      maxPlayers: 'Players must be 2–8',
      character: 'No such character',
      color: 'No such color',
      hand: "That ain't a gun hand, partner",
    },
  },
  // 방 만들기 창
  create: {
    name: 'Room name',
    dice: {
      label: 'Random name',
      // 주사위 이름은 first 하나와 second 하나를 name으로 이음. 어느 조합도 16자 안 (시스템 기획서 방 만들기 창)
      first: ['Dusty', 'Rusty', 'Red', 'Lonely', 'Old', 'Windy', 'Sundown', 'Hot', 'Quiet', 'Last', 'Black', 'Hungry'],
      second: ['Saloon', 'Canyon', 'Depot', 'Mine', 'Ranch', 'Railroad', 'Well', 'Jail', 'Corral', 'Gallows', 'Dunes', 'Trail'],
      name: (first: string, second: string) => `${first} ${second}`,
    },
    rule: '2–16 characters',
    players: 'Players',
    ok: 'Create',
    cancel: 'Cancel',
  },
  // 설정 창
  settings: {
    sensitivity: 'Sensitivity',
    music: 'Music',
    effects: 'Sound effects',
    hand: 'Gun hand',
    right: 'Right',
    left: 'Left',
    crosshair: 'Crosshair',
    ringDot: 'Ring and dot',
    cross: 'Cross',
    dot: 'Dot',
    ring: 'Ring',
    language: 'Language',
    close: 'Close',
  },
}

export type Copy = typeof en
