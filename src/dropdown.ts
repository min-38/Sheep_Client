// 선택 칸을 펼친 목록을 직접 그림 (시스템 기획서 방 화면 버튼과 창 모양). macOS는 select 목록을 운영체제 메뉴로 그려 꾸밀 수 없어서임.
// 값은 숨긴 원래 select가 그대로 들고, 고르면 select 값을 바꾸고 input·change를 보내 기존 코드가 그대로 받음.
// 짜임은 WAI-ARIA APG의 Select-Only Combobox: 칸(button role=combobox)에 초점이 머물고, 가리킨 줄은 aria-activedescendant로 알림

// 열린 목록에서 키에 따라 다음에 가리킬 줄 번호. 목록을 옮기는 키가 아니면 null. 끝에서는 돌지 않음
export function moveActive(key: string, active: number, count: number): number | null {
  switch (key) {
    case 'ArrowDown':
      return Math.min(active + 1, count - 1)
    case 'ArrowUp':
      return Math.max(active - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

// select를 숨기고 바로 뒤에 칸과 목록을 붙임. label은 칸과 목록의 이름이 되는 글자 요소.
// 코드가 select.value를 바꾼 뒤에는 sync를 불러 칸 글자를 맞춤
export function enhanceSelect(select: HTMLSelectElement, label: HTMLElement): { sync(): void } {
  const id = select.id
  const box = document.createElement('div')
  box.className = 'dropdown'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dropdown-button'
  button.setAttribute('role', 'combobox')
  button.setAttribute('aria-haspopup', 'listbox')
  button.setAttribute('aria-expanded', 'false')
  button.setAttribute('aria-controls', `${id}-list`)
  button.setAttribute('aria-labelledby', label.id)
  const list = document.createElement('ul')
  list.className = 'dropdown-list'
  list.id = `${id}-list`
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-labelledby', label.id)
  list.hidden = true
  box.append(button, list)
  select.hidden = true
  select.after(box)

  let active = 0
  const items = () => [...list.children] as HTMLLIElement[]

  function sync() {
    const option = select.selectedOptions[0]
    button.textContent = option?.text ?? ''
    button.lang = option?.lang ?? ''
  }

  function setActive(i: number) {
    active = i
    items().forEach((li, j) => li.classList.toggle('active', j === i))
    const li = items()[i]
    button.setAttribute('aria-activedescendant', li.id)
    li.scrollIntoView({ block: 'nearest' })
  }

  // 열 때마다 select의 줄로 새로 만듦. 언어 목록처럼 나중에 채운 줄도 그대로 보임
  function open() {
    list.replaceChildren(
      ...[...select.options].map((option, i) => {
        const li = document.createElement('li')
        li.id = `${id}-${i}`
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', String(option.selected))
        li.lang = option.lang
        li.textContent = option.text
        li.addEventListener('pointerenter', () => setActive(i))
        li.addEventListener('click', (e) => {
          // 목록이 label 안에 있어 누르면 label이 숨긴 select를 누르려 함. 그것을 막음
          e.preventDefault()
          choose(i)
          button.focus()
        })
        return li
      }),
    )
    list.hidden = false
    button.setAttribute('aria-expanded', 'true')
    setActive(Math.max(select.selectedIndex, 0))
    document.addEventListener('pointerdown', closeOutside, true)
  }

  function close() {
    list.hidden = true
    button.setAttribute('aria-expanded', 'false')
    button.removeAttribute('aria-activedescendant')
    document.removeEventListener('pointerdown', closeOutside, true)
  }

  function closeOutside(e: PointerEvent) {
    if (!box.contains(e.target as Node)) close()
  }

  function choose(i: number) {
    const changed = select.selectedIndex !== i
    select.selectedIndex = i
    sync()
    close()
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  button.addEventListener('click', () => (list.hidden ? open() : close()))
  button.addEventListener('keydown', (e) => {
    if (list.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        open()
      }
      return
    }
    const next = moveActive(e.key, active, items().length)
    if (next !== null) {
      e.preventDefault()
      setActive(next)
    } else if (e.key === 'Enter' || e.key === ' ') {
      // 막지 않으면 버튼 누르기가 이어져 목록이 다시 열림
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      // 창의 Esc(창 닫기)까지 가지 않게 목록만 닫음
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close()
    }
  })

  sync()
  return { sync }
}
