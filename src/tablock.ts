// 같은 브라우저에서 탭 하나만 서버에 붙게 함 (시스템 기획서 방 화면 탭 하나만). 탭마다 사람이 하나씩 생겨 미끼를 세우거나
// 쓰러진 탭으로 관전해 엿보는 것을 막음. 시크릿 창이나 다른 브라우저로는 뚫려 실수와 가벼운 장난만 막음 (기술 설계서 서버/클라 역할 분리)
const NAME = 'game-tab'

// locks가 없으면(개발 빌드, HTTP로 연 보안 컨텍스트 밖) 그냥 접속함. 잠금을 잡으면 접속하고 탭이 닫힐 때까지 쥠.
// 다른 탭이 쥐고 있으면 기다리지 않고 blocked를 부름
export function oneTab(locks: LockManager | undefined, connect: () => void, blocked: () => void) {
  if (!locks) {
    connect()
    return
  }
  locks.request(NAME, { ifAvailable: true }, (lock) => {
    if (lock === null) {
      blocked()
      return
    }
    connect()
    // 이 약속이 끝나지 않는 동안 잠금을 쥠. 탭을 닫거나 탭이 죽으면 브라우저가 풂
    return new Promise<never>(() => {})
  })
}
