// 게임 안 문구의 원본 (CLAUDE.md Client copy). 다른 언어 파일은 이 꼴(Copy)을 그대로 채워야 빌드가 됨.
// 키는 화면별로 묶음. 값을 넣어야 하는 문구는 함수. 말투는 느긋한 서부 사투리이고, 버튼·규칙 안내·설정 항목은 뜻이 바로 읽히게 그대로 둠 (CLAUDE.md Language, SHEEP-135)
export const en = {
  // 설정의 언어 목록에 보이는 이름. 언어마다 그 언어로 씀
  languageName: 'English',
  // 모든 언어에서 같은 영어 제목 (사용자 결정 2026-11-09)
  title: 'The Quick, the Slow and the Shot!',
  // 첫 화면 제목을 세 줄로 나눈 것. 줄마다 오른쪽으로 들여 씀 (SHEEP-111). 브라우저 탭 제목은 위 한 줄
  titleLines: ['The Quick,', 'the Slow', 'and the Shot!'],
  // 결투 화면
  hud: {
    screen: 'The duel',
    hitCard: 'Where my bullet went',
    ammo: (n: number) => `Bullets left: ${n}`,
    timer: 'Time left',
    alive: 'Folks still standing',
    aliveCount: (n: number) => `${n} standin'`,
    banner: 'Round signal',
    watching: "Feller you're watchin'",
    watchingWho: (name: string) => `Watchin' ${name}`,
    replayWho: (name: string) => `Seein' it through ${name}'s eyes`,
    replay: 'Replay',
    leave: 'Leave',
    roomCode: 'Room code',
    // 내가 쓰러졌을 때 가운데에 띄움
    down: 'You bit the dust',
    // "시작!" 신호
    go: 'Draw!',
    // "시작!" 아래 총을 뽑으라는 안내 (SHEEP-138). key 자리에 D 키 모양이 들어감. 규칙 안내라 사투리 없이 바로 읽히게 씀
    drawHint: (key: string) => `Hit ${key} to draw`,
    // 판 도중 포인터가 잠기지 않아 돌 수 없을 때 조준점 아래에 띄움 (SHEEP-152)
    lockHint: 'Click the screen to take aim, partner',
    win: "Last one standin'!",
    // 세레모니 동안 이긴 사람 이름 아래에 적는 한 줄 (SHEEP-142). 이름은 위에 따로 크게 적음
    lastStanding: "Last one standin'",
    // 세레모니 끝 검은 화면의 받은 돈 자막 (SHEEP-150). 윗줄, 가운데 큰 금액(바꾸지 않음), 아랫줄의 이긴 사람 이름
    paidTo: (name: string) => `to ${name}, fair an' square`,
    kills: (n: number) => (n === 1 ? '1 kill' : `${n} kills`),
    lose: 'Not your day, partner',
    rematch: (n: number) => `${n} fellers go again`,
    // 내 사격 결과 카드의 도장
    head: 'Headshot',
    wounded: 'Winged',
    hitDown: 'Dropped',
    miss: 'Plumb missed',
    // 쓰러지는 장면의 자막 카드 (SHEEP-119). 서부 사투리 말투 (CLAUDE.md Language)
    killCard: 'Who brought you down',
    downedBy: 'Downed by',
    outtaTime: 'Outta time',
    killLine: {
      head: (name: string) => `${name}'s bullet found your hat, partner.`,
      body: (name: string) => `${name}'s second slug laid you low, partner.`,
      timeout: 'Ran plumb outta time, partner.',
    },
    // 판 끝 마지막 쓰러짐 보기의 자막 카드 (SHEEP-180). 보는 사람 모두에게 3인칭으로 씀. 서부 사투리 말투 (CLAUDE.md Language)
    lastFall: 'How the last one fell',
    shotDownBy: 'Shot down by',
    fallLine: {
      head: (shooter: string, fallen: string) => `${shooter}'s bullet found ${fallen}'s hat.`,
      body: (shooter: string, fallen: string) => `${shooter}'s second slug laid ${fallen} low.`,
      timeout: (fallen: string) => `${fallen} ran outta time and turned the iron on their own self.`,
    },
  },
  // 술집 대기실과 판 끝 포스터
  saloon: {
    seats: 'Folks at the bar',
    board: 'Room',
    private: 'Invite only',
    leave: 'Leave',
    ready: 'Ready',
    unready: 'Not yet',
    // 캐릭터·색 고르기 판을 펼치는 칠판 아래 버튼. 판 폭(내부 53px)에 말줄임 없이 들어가게 짧게 씀 (SHEEP-173)
    changeCharacter: 'Character',
    settings: 'Settings',
    mySeat: 'My seat',
    // 좌석 꼬리표에 적는 이긴 횟수. 모든 언어가 이 영어를 그대로 씀, 1만 단수 (사용자 결정 2026-11-11, SHEEP-178)
    wins: (n: number) => `${n} Win${n === 1 ? '' : 's'}`,
    // 칠판의 방 코드 복사 (SHEEP-114). 서부 사투리 말투 (CLAUDE.md Language)
    copyCode: 'Copy room code',
    copied: 'Copied, partner',
    // 클립보드가 막혀 코드를 선택해 둠. keys는 Ctrl+C 또는 ⌘C
    copyFailed: (keys: string) => `Press ${keys}, partner`,
    readyStamp: 'Ready',
    // 왼쪽 벽 현상금 게시판의 캐릭터·색 바꾸기 (SHEEP-118). keyParts는 캐릭터 번호 순서의 핵심 파츠 이름, colors는 사람 색 번호 순서의 색 이름
    wardrobe: 'Duds and colors',
    keyParts: ['Neckerchief', 'Sombrero', 'Shirt', 'Corset', 'Waistcoat', 'Coat', 'Hat', 'Poncho'],
    partColor: (part: string) => `${part} color`,
    colors: ['Red', 'Sky blue', 'Purple', 'Yellow', 'Orange', 'Pink', 'White', 'Black'],
    // 방 안 다른 사람이 쓰는 색. 서부 사투리 말투 (CLAUDE.md Language)
    colorTaken: (color: string) => `${color}, spoken for`,
    // 술집 주인 말풍선 (SHEEP-116). 팁은 지금 규칙(시스템 기획서)을 알려 주고, 농담은 쓸데없는 말. 서부 사투리 말투 (CLAUDE.md Language)
    bartender: {
      tips: [
        "Hold that iron still a spell 'fore you shoot. Shaky hands miss, partner.",
        "Spin 'round fast and your aim'll wobble somethin' fierce. Let it settle.",
        "One bullet a round. Reckon you'd best make it count.",
        "Hit a man in the head, he's done. Gut him once, he's still standin'. Twice, he ain't.",
        `Five seconds after "Draw!", partner. Dawdle past that and you'll do the undertaker's job yourself.`,
        "Ever'body turns slow and walks ten paces. Ain't no stoppin' short, partner.",
        'Two fellers drop at once? Reckon they stand up and go again.',
        "Get shot and you can still watch through the eyes of them standin'. Click to switch.",
        "Iron stays holstered 'til the word. Then hit D to draw, partner.",
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
    nickname: 'What do folks call you?',
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
    doubleClick: 'Double-click a room to mosey in',
    create: 'Create room',
    settings: 'Settings',
    connecting: "Ridin' out to the server…",
    disconnected: 'Lost the trail to the server. Refresh the page to ride back in.',
    // 같은 브라우저의 다른 탭이 이미 접속해 있을 때 (시스템 기획서 방 화면 탭 하나만)
    otherTab: "You're already in town in another tab. Close that one, then refresh this page.",
    noRooms: 'No open rooms. Quiet town today.',
    // 방 목록 한 줄에 3명까지 적고 나머지는 수만 (시스템 기획서 방 화면 대기실 보기)
    members: (names: string, more: number) => `${names} and ${more} more`,
    playing: 'Duel on',
    full: 'Full up',
    waiting: "Waitin'",
    // 서버가 입장을 거절한 사유 (기술 설계서 메시지 error)
    reasons: {
      notFound: "Ain't no room with that code",
      full: "That room's full up",
      playing: "They're mid-duel in there. Come back after.",
      nickname: "That name won't do, partner",
      roomName: "That room name won't do",
      maxPlayers: 'Two to eight shooters, no more, no less',
      character: "Ain't no such character",
      color: "Ain't no such color",
      hand: "That ain't a gun hand, partner",
    },
  },
  // 방 만들기 창
  create: {
    name: 'Room name',
    dice: {
      label: 'Roll for a name',
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
