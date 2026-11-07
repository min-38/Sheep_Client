import { describe, expect, test } from 'vitest'
import { fireMessage, parseServerMessage, stopMessage } from './net.ts'

describe('parseServerMessage', () => {
  test('방 만들기와 입장 응답은 내 플레이어 id를 받음', () => {
    expect(parseServerMessage('{"type":"roomCreated","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'roomCreated', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD","playerId":"p1"}')).toEqual({ type: 'joined', code: 'AB12CD', playerId: 'p1' })
    expect(parseServerMessage('{"type":"joined","code":"AB12CD"}')).toBeNull()
  })

  test('닉네임 거절도 입장 거절로 받음', () => {
    expect(parseServerMessage('{"type":"error","reason":"nickname"}')).toEqual({ type: 'error', reason: 'nickname' })
  })

  test('상태의 닉네임은 문자열, 색은 0~7 정수만 받음 (기술 설계서 메시지 state)', () => {
    const player = (extra: string) => `{"type":"state","tick":1,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand","ready":false${extra}}]}`
    expect(parseServerMessage(player(',"nickname":"보안관","color":3'))).not.toBeNull()
    expect(parseServerMessage(player(',"color":3'))).toBeNull()
    expect(parseServerMessage(player(',"nickname":"보안관"'))).toBeNull()
    expect(parseServerMessage(player(',"nickname":7,"color":3'))).toBeNull()
    expect(parseServerMessage(player(',"nickname":"보안관","color":8'))).toBeNull()
    expect(parseServerMessage(player(',"nickname":"보안관","color":1.5'))).toBeNull()
  })

  test('입장 거절은 정해진 사유만 받음', () => {
    expect(parseServerMessage('{"type":"error","reason":"notFound"}')).toEqual({ type: 'error', reason: 'notFound' })
    expect(parseServerMessage('{"type":"error","reason":"full"}')).toEqual({ type: 'error', reason: 'full' })
    expect(parseServerMessage('{"type":"error","reason":"playing"}')).toEqual({ type: 'error', reason: 'playing' })
    expect(parseServerMessage('{"type":"error","reason":"busy"}')).toBeNull()
  })

  test('맵은 [y][x]로 받음', () => {
    const text = '{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,0,1]]}'
    expect(parseServerMessage(text)).toEqual({ type: 'map', width: 3, height: 2, cells: [[1, 1, 1], [1, 0, 1]] })
  })

  test('크기가 맞지 않거나 숫자가 아닌 맵은 버림', () => {
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,0]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2,"cells":[[1,1,1],[1,"0",1]]}')).toBeNull()
    expect(parseServerMessage('{"type":"map","width":3,"height":2}')).toBeNull()
  })

  test('상태는 틱 번호와 모든 플레이어의 위치, 각도, 동작, 준비 여부를 받음', () => {
    const text = '{"type":"state","tick":7,"players":[{"id":"p1","x":10.5,"y":4,"angle":1.57,"pose":"stand","ready":true,"nickname":"보안관","color":0},{"id":"p2","x":10.5,"y":17,"angle":4.71,"pose":"walk","ready":false,"nickname":"떠돌이","color":1}]}'
    expect(parseServerMessage(text)).toEqual({
      type: 'state',
      tick: 7,
      players: [
        { id: 'p1', x: 10.5, y: 4, angle: 1.57, pose: 'stand', ready: true, nickname: '보안관', color: 0 },
        { id: 'p2', x: 10.5, y: 17, angle: 4.71, pose: 'walk', ready: false, nickname: '떠돌이', color: 1 },
      ],
    })
  })

  test('쓰러진 사람의 동작은 down', () => {
    const text = '{"type":"state","tick":9,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"down","ready":false,"nickname":"보안관","color":7}]}'
    expect(parseServerMessage(text)).toEqual({ type: 'state', tick: 9, players: [{ id: 'p1', x: 1, y: 1, angle: 0, pose: 'down', ready: false, nickname: '보안관', color: 7 }] })
  })

  test('모양이 틀린 상태는 버림', () => {
    expect(parseServerMessage('{"type":"state","players":[]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":1,"x":1,"y":1,"angle":0,"pose":"stand","ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":"1","y":1,"angle":0,"pose":"stand","ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"pose":"stand","ready":false}]}')).toBeNull()
    // 준비 여부는 true·false만 받음 (기술 설계서 메시지 state)
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand"}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand","ready":"true"}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"stand","ready":1}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[null]}')).toBeNull()
    // 동작은 표에 있는 이름만 받음 (기술 설계서 메시지 state)
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"ready":false}]}')).toBeNull()
    expect(parseServerMessage('{"type":"state","tick":7,"players":[{"id":"p1","x":1,"y":1,"angle":0,"pose":"run","ready":false}]}')).toBeNull()
  })

  test('시계 맞추기 답은 보낸 t0과 서버 시각 ts를 받음', () => {
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5,"ts":98765.25}')).toEqual({ type: 'serverTime', t0: 1234.5, ts: 98765.25 })
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5}')).toBeNull()
    expect(parseServerMessage('{"type":"serverTime","t0":"1234.5","ts":98765.25}')).toBeNull()
    expect(parseServerMessage('{"type":"serverTime","t0":1234.5,"ts":null}')).toBeNull()
  })

  test('판 단계는 단계 이름과 그 단계가 시작하는 서버 시각을 받음', () => {
    expect(parseServerMessage('{"type":"phase","phase":"countdown","at":1500.5}')).toEqual({ type: 'phase', phase: 'countdown', at: 1500.5 })
    expect(parseServerMessage('{"type":"phase","phase":"walk","at":4500.5}')).toEqual({ type: 'phase', phase: 'walk', at: 4500.5 })
    expect(parseServerMessage('{"type":"phase","phase":"duel","at":7500.5}')).toEqual({ type: 'phase', phase: 'duel', at: 7500.5 })
    // 판이 끝나 준비 중으로 돌아가는 시각
    expect(parseServerMessage('{"type":"phase","phase":"lobby","at":12000}')).toEqual({ type: 'phase', phase: 'lobby', at: 12000 })
    expect(parseServerMessage('{"type":"phase","phase":"result","at":12000}')).toBeNull()
    expect(parseServerMessage('{"type":"phase","phase":"walk"}')).toBeNull()
    expect(parseServerMessage('{"type":"phase","phase":"walk","at":"4500"}')).toBeNull()
  })

  test('발사 이벤트는 쏜 사람과 쏜 각도를 받음', () => {
    expect(parseServerMessage('{"type":"shot","playerId":"p2","angle":3.14}')).toEqual({ type: 'shot', playerId: 'p2', angle: 3.14 })
    expect(parseServerMessage('{"type":"shot","angle":3.14}')).toBeNull()
    expect(parseServerMessage('{"type":"shot","playerId":"p2"}')).toBeNull()
    expect(parseServerMessage('{"type":"shot","playerId":"p2","angle":"3.14"}')).toBeNull()
  })

  test('탈락은 쓰러진 사람과 사유를 받음', () => {
    expect(parseServerMessage('{"type":"eliminated","playerId":"p2","reason":"shot"}')).toEqual({ type: 'eliminated', playerId: 'p2', reason: 'shot' })
    expect(parseServerMessage('{"type":"eliminated","playerId":"p2","reason":"timeout"}')).toEqual({ type: 'eliminated', playerId: 'p2', reason: 'timeout' })
    expect(parseServerMessage('{"type":"eliminated","reason":"shot"}')).toBeNull()
    expect(parseServerMessage('{"type":"eliminated","playerId":2,"reason":"shot"}')).toBeNull()
  })

  test('사유가 없거나 표에 없는 탈락은 버림', () => {
    expect(parseServerMessage('{"type":"eliminated","playerId":"p2"}')).toBeNull()
    expect(parseServerMessage('{"type":"eliminated","playerId":"p2","reason":"fall"}')).toBeNull()
  })

  test('사격 결과는 맞은 부위, 높이, 오른쪽 거리, 쓰러졌는지를 받음', () => {
    expect(parseServerMessage('{"type":"shotResult","zone":"head","height":0.8,"offset":-0.05,"down":true}')).toEqual({
      type: 'shotResult',
      zone: 'head',
      height: 0.8,
      offset: -0.05,
      down: true,
    })
    expect(parseServerMessage('{"type":"shotResult","zone":"body","height":0.4,"offset":0.1,"down":false}')).toEqual({
      type: 'shotResult',
      zone: 'body',
      height: 0.4,
      offset: 0.1,
      down: false,
    })
  })

  test('빗나간 사격 결과는 부위, 높이, 오른쪽 거리가 모두 null', () => {
    expect(parseServerMessage('{"type":"shotResult","zone":null,"height":null,"offset":null,"down":false}')).toEqual({
      type: 'shotResult',
      zone: null,
      height: null,
      offset: null,
      down: false,
    })
  })

  test('모양이 틀린 사격 결과는 버림', () => {
    expect(parseServerMessage('{"type":"shotResult","zone":"leg","height":0.4,"offset":0,"down":false}')).toBeNull()
    expect(parseServerMessage('{"type":"shotResult","zone":"head","height":0.8,"offset":0}')).toBeNull()
    // 맞았는데 자리가 없거나, 빗나갔는데 자리가 있음
    expect(parseServerMessage('{"type":"shotResult","zone":"body","height":null,"offset":null,"down":false}')).toBeNull()
    expect(parseServerMessage('{"type":"shotResult","zone":null,"height":0.4,"offset":0,"down":false}')).toBeNull()
  })

  test('반샷 알림은 type만 받음', () => {
    expect(parseServerMessage('{"type":"wounded"}')).toEqual({ type: 'wounded' })
  })

  test('판 결과는 승리나 재대결, 해당하는 사람들, 재대결 장전 수를 받음', () => {
    expect(parseServerMessage('{"type":"result","outcome":"win","playerIds":["p1"],"rounds":0}')).toEqual({ type: 'result', outcome: 'win', playerIds: ['p1'], rounds: 0 })
    expect(parseServerMessage('{"type":"result","outcome":"rematch","playerIds":["p1","p2"],"rounds":2}')).toEqual({
      type: 'result',
      outcome: 'rematch',
      playerIds: ['p1', 'p2'],
      rounds: 2,
    })
  })

  test('모양이 틀린 판 결과는 버림', () => {
    expect(parseServerMessage('{"type":"result","outcome":"draw","playerIds":["p1"],"rounds":0}')).toBeNull()
    expect(parseServerMessage('{"type":"result","playerIds":["p1"],"rounds":0}')).toBeNull()
    expect(parseServerMessage('{"type":"result","outcome":"win","playerIds":"p1","rounds":0}')).toBeNull()
    expect(parseServerMessage('{"type":"result","outcome":"win","playerIds":[1],"rounds":0}')).toBeNull()
    expect(parseServerMessage('{"type":"result","outcome":"win","playerIds":["p1"]}')).toBeNull()
    // 장전 수는 0 이상의 정수 (기술 설계서 메시지 result)
    expect(parseServerMessage('{"type":"result","outcome":"rematch","playerIds":["p1","p2"],"rounds":"2"}')).toBeNull()
    expect(parseServerMessage('{"type":"result","outcome":"rematch","playerIds":["p1","p2"],"rounds":1.5}')).toBeNull()
    expect(parseServerMessage('{"type":"result","outcome":"rematch","playerIds":["p1","p2"],"rounds":-1}')).toBeNull()
  })

  test('깨진 JSON, 모르는 type, 빠진 필드는 버림', () => {
    expect(parseServerMessage('{"type":')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"hello"}')).toBeNull()
    expect(parseServerMessage('{"type":"joined"}')).toBeNull()
  })
})

describe('fireMessage', () => {
  test('쏜 시각을 서버 시계로 바꿔 보냄', () => {
    // 서버 시계가 4000ms 앞섬. 내 1000은 서버 5000
    expect(fireMessage(1.5, 0, 1000, 4000)).toEqual({ type: 'fire', angle: 1.5, pitch: 0, at: 5000 })
    // 서버 시계가 500ms 뒤처짐. 내 1000은 서버 500
    expect(fireMessage(0, 0, 1000, -500)).toEqual({ type: 'fire', angle: 0, pitch: 0, at: 500 })
  })

  test('위아래 각도를 함께 보냄', () => {
    expect(fireMessage(1, 0.2, 100, 5)).toEqual({ type: 'fire', angle: 1, pitch: 0.2, at: 105 })
  })
})

describe('stopMessage', () => {
  test('누른 순간 내 시각을 서버 시계로 바꿔 보냄', () => {
    expect(stopMessage(1000, 4000)).toEqual({ type: 'stop', at: 5000 })
    expect(stopMessage(1000, -500)).toEqual({ type: 'stop', at: 500 })
  })
})
