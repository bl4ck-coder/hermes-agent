// Ops (P0.5) locale catalog. Every string the Ops shell, primitives and W10
// states render lives here, for every bundled Desktop locale. The catalog is
// registered through the existing Desktop mechanism: `Translations.ops` and
// `Translations.opsStates` (en.ts spreads the English entry, each locale
// overlay spreads its own), so `useI18n().t.ops` follows the selected locale.
// `Ops` is the product name and is intentionally not translated.
import { T } from './main-i18n'
import type { OpsStatesTranslations } from '@/i18n/types_ops_states'

type Fn1 = (value: string) => string
type FnN = (value: number | string) => string

import { inspectorFields } from './inspector-i18n'

export interface OpsCopy {
  brand: string
  unavailable: string
  unknown: string
  readOnly: string
  presence: Record<'working' | 'needs_you' | 'blocked' | 'idle' | 'offline' | 'unknown' | 'stale' | 'done', string>
  shapes: Record<
    'disc' | 'reduced-disc' | 'ringed' | 'triangle' | 'dot' | 'hollow' | 'dotted' | 'barred' | 'static-disc',
    string
  >
  nav: Record<
    | 'runs'
    | 'review'
    | 'templates'
    | 'projects'
    | 'files'
    | 'conversations'
    | 'skills'
    | 'channels'
    | 'activity'
    | 'triggers'
    | 'schedule'
    | 'memory'
    | 'profiles'
    | 'agents'
    | 'office'
    | 'canvas'
    | 'board',
    string
  >
  rail: {
    label: string
    switcher: string
    connection: string
    profile: string
    showFilter: string
    filter: string
    filterPlaceholder: string
    clearFilter: string
    palette: string
    sectionOps: string
    pinned: string
    noPins: string
    lenses: string
    pin: string
    unpin: string
    pinItem: Fn1
    unpinItem: Fn1
    more: string
    needsYou: string
    connect: string
    settings: string
    fleet: string
    online: FnN
    idleCount: FnN
  }
  chrome: {
    breadcrumb: string
    searchOps: string
    toggleRail: string
    toggleDock: string
    toggleInspector: string
    focusedRun: FnN
    working: FnN
    needsYou: FnN
    tokens: FnN
    workingSource: string
    needsYouSource: string
    gatewaySource: string
    dock: string
    dockOpen: string
    problems: FnN
  }
  toolbar: {
    back: string
    rail: string
    inspector: string
    dock: string
    copyLink: string
    restoreSplit: string
    fullScreen: string
    openChat: string
  }
  reasons: {
    modelEdit: string
    mutation: string
    approve: string
  }
  palette: {
    recent: string
    group: string
    commands: Record<
      | 'go-office'
      | 'go-canvas'
      | 'go-board'
      | 'go-runs'
      | 'go-skills'
      | 'settings'
      | 'switch-theme'
      | 'shortcut-sheet'
      | 'focus-next-approval'
      | 'create-task'
      | 'create-project'
      | 'approve'
      | 'set-model'
      | 'restore',
      string
    >
  }
  shortcuts: {
    title: string
    description: string
    close: string
    actions: Record<OpsShortcutId, string>
  }
  inspector: {
    label: string
    close: string
    slots: Record<'fleet' | 'context' | 'task' | 'node' | 'history' | 'events' | 'row', string>
    selection: string
    detailUnavailable: Fn1
    /** B11: inspector labels/values keyed by the English string. */
    fields: Record<string, string>
    runEventsEmpty: string
  }
  dock: {
    label: string
    close: string
    slots: Record<'log' | 'events' | 'problems', string>
    noLog: string
    noEvents: string
    problemsUnavailable: string
    noProblems: string
  }
  tabs: {
    label: string
    labelActive: Fn1
    close: Fn1
    more: FnN
    pin: Fn1
    unpin: Fn1
    noRoute: Fn1
  }
  toast: {
    dismiss: Fn1
    open: string
    undo: string
    moreNeedsYou: FnN
    kinds: Record<'move' | 'archive' | 'reassign' | 'approval' | 'blocked' | 'stop', string>
  }
  table: { caption: string; empty: string; sortBy: Fn1 }
  node: { edit: string; port: FnN }
  motion: { rowDescription: string }
  why: { missingReason: string; prefix: string; observed: Fn1 }
}

export type OpsShortcutId =
  | 'goOffice'
  | 'goCanvas'
  | 'goBoard'
  | 'goRuns'
  | 'goSkills'
  | 'create'
  | 'filter'
  | 'sheet'
  | 'edit'
  | 'rail'
  | 'inspector'
  | 'move'
  | 'open'
  | 'closeTab'
  | 'cycleTabs'
  | 'history'
  | 'settings'
  | 'search'
  | 'escape'

export type OpsStatesCopy = OpsStatesTranslations['opsStates']

export const OPS_LOCALE_IDS = ['en', 'zh', 'zh-hant', 'ja', 'ar', 'ru', 'fr', 'de', 'es'] as const
export type OpsLocaleId = (typeof OPS_LOCALE_IDS)[number]


const opsEn: OpsCopy = {
  brand: "Ops",
  unavailable: "unavailable",
  unknown: "unknown",
  readOnly: "read-only",
  presence: {
    working: "working",
    needs_you: "needs-you",
    blocked: "blocked",
    idle: "idle",
    offline: "offline",
    unknown: "unknown",
    done: "done",
    stale: "stale"
  },
  shapes: {
    disc: "filled disc",
    "reduced-disc": "filled disc with hugging stroke",
    ringed: "ringed disc",
    triangle: "triangle",
    dot: "middle dot",
    hollow: "hollow disc",
    dotted: "dotted circle",
    barred: "barred circle",
    "static-disc": "static disc"
  },
  nav: {
    runs: "Runs",
    review: "Review",
    templates: "Templates",
    projects: "Projects",
    files: "Files",
    conversations: "Conversations",
    skills: "Skills",
    channels: "Channels & MCP",
    activity: "Activity",
    triggers: "Triggers",
    schedule: "Schedule",
    memory: "Memory",
    profiles: "Profiles",
    agents: "Agents",
    office: "Office",
    canvas: "Canvas",
    board: "Board"
  },
  rail: {
    label: "Ops",
    switcher: "Connection and profile",
    connection: "Connection",
    profile: "Profile",
    showFilter: "Show filter",
    filter: "Filter fleet and lenses",
    filterPlaceholder: "Filter",
    clearFilter: "Clear filter",
    palette: "Palette",
    sectionOps: "OPS",
    pinned: "Pinned",
    noPins: "No pins",
    lenses: "LENSES",
    pin: "Pin",
    unpin: "Unpin",
    pinItem: value => `Pin ${value}`,
    unpinItem: value => `Unpin ${value}`,
    more: "More",
    needsYou: "Needs-you",
    connect: "+ Connect",
    settings: "Settings",
    fleet: "FLEET",
    idleCount: value => `${value} idle`,
    online: value => `${value} online`
  },
  chrome: {
    breadcrumb: "Ops breadcrumb",
    searchOps: "Search Ops",
    toggleRail: "Toggle rail",
    toggleDock: "Toggle dock",
    toggleInspector: "Toggle inspector",
    focusedRun: value => `run #${value}`,
    working: value => `${value} working`,
    needsYou: value => `${value} needs you`,
    tokens: value => `${value} tok`,
    workingSource: "Fresh A1 fleet observation",
    needsYouSource: "Fresh A1/A3 fleet observation",
    gatewaySource: "/api/status gateway state + backend version · pinned owner",
    dock: "Dock",
    dockOpen: "Dock open",
    problems: value => `Problems ${value}`
  },
  toolbar: {
    back: "← Chats",
    rail: "Rail",
    inspector: "Inspector",
    dock: "Dock",
    copyLink: "Copy link",
    restoreSplit: "Restore split",
    fullScreen: "Full screen Ops",
    openChat: "Open the existing chat"
  },
  reasons: {
    modelEdit: "Editing unavailable until A5/A6",
    mutation: "Unavailable until A5/A6 writes exist",
    approve: "No shortcut approves. Go to next approval only moves focus."
  },
  palette: {
    recent: "Recent searches",
    group: "Ops",
    commands: {
      "go-office": "Go to Office",
      "go-canvas": "Go to Canvas",
      "go-board": "Go to Board",
      "go-runs": "Go to Runs",
      "go-skills": "Go to Skills",
      settings: "Settings",
      "switch-theme": "Switch theme",
      "shortcut-sheet": "Shortcut sheet",
      "focus-next-approval": "Go to next approval",
      "create-task": "Create task",
      "create-project": "Create project",
      approve: "Approve",
      "set-model": "Set model",
      restore: "Restore profile"
    }
  },
  shortcuts: {
    title: "Ops shortcuts",
    description: "Ctrl+J stays the Desktop sidebar. Toggle the dock in the titlebar or status bar. No shortcut approves unseen content.",
    close: "Close",
    actions: {
      goOffice: "Office",
      goCanvas: "Canvas",
      goBoard: "Board",
      goRuns: "Runs",
      goSkills: "Skills",
      create: "Focus the create surface. Does not create a task.",
      filter: "Rail filter",
      sheet: "Shortcut sheet",
      edit: "Edit the focused Ops object",
      rail: "Toggle rail",
      inspector: "Toggle inspector",
      move: "Move selection",
      open: "Open the focused row. Does not approve.",
      closeTab: "Close the active non-pinned Ops tab. Never the window.",
      cycleTabs: "Cycle Ops document tabs",
      history: "Tab history",
      settings: "Ops settings",
      search: "Search Ops in the existing palette",
      escape: "Close the innermost layer, then full-screen"
    }
  },
  inspector: {
    label: "Inspector",
    close: "Close inspector",
    slots: {
      fleet: "Fleet",
      context: "Context",
      task: "Task",
      node: "Node",
      history: "History",
      events: "Events",
      row: "Row"
    },
    selection: "Selection",
    detailUnavailable: value => `Nothing selected in ${value} yet. Select an item to see its detail here.`,
    fields: inspectorFields('en'),
    runEventsEmpty: "Run events stay empty until a focused run supplies them."
  },
  dock: {
    label: "Ops dock",
    close: "Close dock",
    slots: {
      log: "Log",
      events: "Events",
      problems: "Problems"
    },
    noLog: "No log lines",
    noEvents: "No events",
    problemsUnavailable: "Problems unavailable",
    noProblems: "No problems"
  },
  tabs: {
    label: "Ops tabs",
    labelActive: value => `Ops tabs, ${value}`,
    close: value => `Close ${value}`,
    more: value => `More tabs, ${value} overflow`,
    pin: value => `Pin ${value}`,
    unpin: value => `Unpin ${value}`,
    noRoute: value => `No Desktop route for ${value}. This shell does not invent one.`
  },
  toast: {
    open: "Open",
    undo: "Undo",
    moreNeedsYou: value => `+${value} more → Needs-you`,
    kinds: {
      move: "move",
      archive: "archive",
      reassign: "reassign",
      approval: "approval",
      blocked: "blocked",
      stop: "stop"
    },
    dismiss: value => `Dismiss ${value}`
  },
  table: {
    caption: "Table",
    empty: "No rows",
    sortBy: value => `Sort by ${value}`
  },
  node: {
    edit: "Edit",
    port: value => `port ${value}`
  },
  motion: {
    rowDescription: "States still change and stay readable"
  },
  why: {
    prefix: "why · what for:",
    observed: value => `observed ${value}`,
    missingReason: "reason not recorded"
  }
}

const opsStatesEn: OpsStatesCopy = {
  empty: {
    title: "Nothing here yet",
    explanation: "The source answered and has no items for this view.",
    action: "Refresh"
  },
  loading: {
    title: "Loading",
    explanation: "Fetching this view from its own source. Other views keep working.",
    action: "Retry now"
  },
  reconnecting: {
    title: "Reconnecting",
    explanation: "The source stopped answering. Retrying automatically; any last snapshot stays visible.",
    action: "Reconnect now"
  },
  stale: {
    title: "Showing the last snapshot",
    explanation: "This data is older than its freshness budget. It is kept readable until a refresh succeeds.",
    action: "Refresh"
  },
  exhausted: {
    title: "Retries stopped",
    explanation: "Automatic retries reached their limit. Nothing retries again until you ask.",
    action: "Try again"
  },
  auth: {
    title: "Authentication failed",
    explanation: "The source rejected the credentials (401/403). Retrying will not help until you sign in again.",
    action: "Sign in again"
  },
  capability: {
    title: "Not available on this connection",
    explanation: "This backend does not expose the capability this view needs. This is not a temporary failure.",
    action: "View requirements"
  },
  crashed: {
    title: "This view failed to render",
    explanation: "Only this view stopped. The rest of the page keeps working.",
    action: "Reload view"
  },
  source: value => `Source: ${value}`,
  sourceUnknown: "Source: not recorded",
  updated: value => `Updated ${value}`,
  neverUpdated: "Never updated",
  attempt: (a, b) => `Attempt ${a} of ${b}`,
  capabilityName: value => `Needs: ${value}`,
  writesDisabled: "Changes are disabled until this view is current."
}

const opsZh: OpsCopy = {
  brand: "Ops",
  unavailable: "不可用",
  unknown: "未知",
  readOnly: "只读",
  presence: {
    working: "工作中",
    needs_you: "需要你",
    blocked: "已阻塞",
    idle: "空闲",
    offline: "离线",
    unknown: "未知",
    done: "已完成",
    stale: "已过时"
  },
  shapes: {
    disc: "实心圆",
    "reduced-disc": "带贴合描边的实心圆",
    ringed: "带环圆",
    triangle: "三角形",
    dot: "中点",
    hollow: "空心圆",
    dotted: "虚线圆",
    barred: "带横杠的圆",
    "static-disc": "静态圆"
  },
  nav: {
    runs: "运行",
    review: "审阅",
    templates: "模板",
    projects: "项目",
    files: "文件",
    conversations: "对话",
    skills: "技能",
    channels: "频道与 MCP",
    activity: "活动",
    triggers: "触发器",
    schedule: "计划",
    memory: "记忆",
    profiles: "配置文件",
    agents: "智能体",
    office: "办公室",
    canvas: "画布",
    board: "看板"
  },
  rail: {
    label: "Ops",
    switcher: "连接和配置文件",
    connection: "连接",
    profile: "配置文件",
    showFilter: "显示筛选",
    filter: "筛选队列和视图",
    filterPlaceholder: "筛选",
    clearFilter: "清除筛选",
    palette: "命令面板",
    sectionOps: "OPS",
    pinned: "已固定",
    noPins: "没有固定项",
    lenses: "视图",
    pin: "固定",
    unpin: "取消固定",
    pinItem: value => `固定 ${value}`,
    unpinItem: value => `取消固定 ${value}`,
    more: "更多",
    needsYou: "需要你",
    connect: "+ 连接",
    settings: "设置",
    fleet: "队列",
    idleCount: value => `${value} 个空闲`,
    online: value => `${value} 在线`
  },
  chrome: {
    breadcrumb: "Ops 导航路径",
    searchOps: "搜索 Ops",
    toggleRail: "切换侧栏",
    toggleDock: "切换停靠栏",
    toggleInspector: "切换检查器",
    focusedRun: value => `运行 #${value}`,
    working: value => `${value} 个工作中`,
    needsYou: value => `${value} 个需要你`,
    tokens: value => `${value} 令牌`,
    workingSource: "最新的 A1 队列观测",
    needsYouSource: "最新的 A1/A3 队列观测",
    gatewaySource: "/api/status 网关状态 + 后端版本 · 固定所有者",
    dock: "停靠栏",
    dockOpen: "停靠栏已打开",
    problems: value => `问题 ${value}`
  },
  toolbar: {
    back: "← 聊天",
    rail: "侧栏",
    inspector: "检查器",
    dock: "停靠栏",
    copyLink: "复制链接",
    restoreSplit: "恢复分屏",
    fullScreen: "全屏 Ops",
    openChat: "打开现有聊天"
  },
  reasons: {
    modelEdit: "在 A5/A6 之前无法编辑",
    mutation: "在 A5/A6 写入可用之前不可用",
    approve: "没有快捷键会批准。“转到下一个批准”只移动焦点。"
  },
  palette: {
    recent: "最近搜索",
    group: "Ops",
    commands: {
      "go-office": "转到办公室",
      "go-canvas": "转到画布",
      "go-board": "转到看板",
      "go-runs": "转到运行",
      "go-skills": "转到技能",
      settings: "设置",
      "switch-theme": "切换主题",
      "shortcut-sheet": "快捷键表",
      "focus-next-approval": "转到下一个批准",
      "create-task": "创建任务",
      "create-project": "创建项目",
      approve: "批准",
      "set-model": "设置模型",
      restore: "恢复配置文件"
    }
  },
  shortcuts: {
    title: "Ops 快捷键",
    description: "Ctrl+J 仍是桌面侧边栏。在标题栏或状态栏中切换停靠栏。没有快捷键会批准未查看的内容。",
    close: "关闭",
    actions: {
      goOffice: "办公室",
      goCanvas: "画布",
      goBoard: "看板",
      goRuns: "运行",
      goSkills: "技能",
      create: "聚焦创建区域。不会创建任务。",
      filter: "侧栏筛选",
      sheet: "快捷键表",
      edit: "编辑当前聚焦的 Ops 对象",
      rail: "切换侧栏",
      inspector: "切换检查器",
      move: "移动选择",
      open: "打开聚焦的行。不会批准。",
      closeTab: "关闭当前未固定的 Ops 标签页。绝不关闭窗口。",
      cycleTabs: "循环切换 Ops 文档标签页",
      history: "标签页历史",
      settings: "Ops 设置",
      search: "在现有命令面板中搜索 Ops",
      escape: "关闭最内层，然后退出全屏"
    }
  },
  inspector: {
    label: "检查器",
    close: "关闭检查器",
    slots: {
      fleet: "队列",
      context: "上下文",
      task: "任务",
      node: "节点",
      history: "历史",
      events: "事件",
      row: "行"
    },
    selection: "所选项",
    detailUnavailable: value => `${value} 中尚未选择任何内容。选择一项即可在此查看详情。`,
    fields: inspectorFields('zh'),
    runEventsEmpty: "在聚焦的运行提供事件之前，运行事件保持为空。"
  },
  dock: {
    label: "Ops 停靠栏",
    close: "关闭停靠栏",
    slots: {
      log: "日志",
      events: "事件",
      problems: "问题"
    },
    noLog: "没有日志行",
    noEvents: "没有事件",
    problemsUnavailable: "问题不可用",
    noProblems: "没有问题"
  },
  tabs: {
    label: "Ops 标签页",
    labelActive: value => `Ops 标签页，${value}`,
    close: value => `关闭 ${value}`,
    more: value => `更多标签页，溢出 ${value} 个`,
    pin: value => `固定 ${value}`,
    unpin: value => `取消固定 ${value}`,
    noRoute: value => `${value} 没有桌面路由。此外壳不会凭空创建。`
  },
  toast: {
    open: "打开",
    undo: "撤销",
    moreNeedsYou: value => `+${value} 个更多 → 需要你`,
    kinds: {
      move: "移动",
      archive: "归档",
      reassign: "重新分配",
      approval: "批准",
      blocked: "已阻塞",
      stop: "停止"
    },
    dismiss: value => `关闭 ${value}`
  },
  table: {
    caption: "表格",
    empty: "没有行",
    sortBy: value => `按 ${value} 排序`
  },
  node: {
    edit: "编辑",
    port: value => `端口 ${value}`
  },
  motion: {
    rowDescription: "状态仍会变化并保持可读"
  },
  why: {
    prefix: "原因 · 用途：",
    observed: value => `观测于 ${value}`,
    missingReason: "未记录原因"
  }
}

const opsStatesZh: OpsStatesCopy = {
  empty: {
    title: "暂无内容",
    explanation: "数据源已响应，但此视图没有项目。",
    action: "刷新"
  },
  loading: {
    title: "加载中",
    explanation: "正在从其自身数据源获取此视图。其他视图照常工作。",
    action: "立即重试"
  },
  reconnecting: {
    title: "正在重新连接",
    explanation: "数据源停止响应。正在自动重试；最后的快照仍保持可见。",
    action: "立即重新连接"
  },
  stale: {
    title: "显示最后的快照",
    explanation: "此数据已超出其新鲜度期限。在刷新成功之前保持可读。",
    action: "刷新"
  },
  exhausted: {
    title: "已停止重试",
    explanation: "自动重试已达上限。在你请求之前不会再次重试。",
    action: "重试"
  },
  auth: {
    title: "身份验证失败",
    explanation: "数据源拒绝了凭据（401/403）。在重新登录之前重试无济于事。",
    action: "重新登录"
  },
  capability: {
    title: "此连接不可用",
    explanation: "此后端未提供此视图所需的功能。这不是暂时性故障。",
    action: "查看要求"
  },
  crashed: {
    title: "此视图渲染失败",
    explanation: "只有此视图停止了。页面其余部分照常工作。",
    action: "重新加载视图"
  },
  source: value => `来源：${value}`,
  sourceUnknown: "来源：未记录",
  updated: value => `更新于 ${value}`,
  neverUpdated: "从未更新",
  attempt: (a, b) => `第 ${a} 次尝试，共 ${b} 次`,
  capabilityName: value => `需要：${value}`,
  writesDisabled: "在此视图更新为最新之前，更改已禁用。"
}

const opsZhHant: OpsCopy = {
  brand: "Ops",
  unavailable: "無法使用",
  unknown: "未知",
  readOnly: "唯讀",
  presence: {
    working: "工作中",
    needs_you: "需要你",
    blocked: "已封鎖",
    idle: "閒置",
    offline: "離線",
    unknown: "未知",
    done: "已完成",
    stale: "已過時"
  },
  shapes: {
    disc: "實心圓",
    "reduced-disc": "帶貼合描邊的實心圓",
    ringed: "帶環圓",
    triangle: "三角形",
    dot: "中點",
    hollow: "空心圓",
    dotted: "虛線圓",
    barred: "帶橫槓的圓",
    "static-disc": "靜態圓"
  },
  nav: {
    runs: "執行",
    review: "審閱",
    templates: "範本",
    projects: "專案",
    files: "檔案",
    conversations: "對話",
    skills: "技能",
    channels: "頻道與 MCP",
    activity: "活動",
    triggers: "觸發器",
    schedule: "排程",
    memory: "記憶",
    profiles: "設定檔",
    agents: "代理",
    office: "辦公室",
    canvas: "畫布",
    board: "看板"
  },
  rail: {
    label: "Ops",
    switcher: "連線與設定檔",
    connection: "連線",
    profile: "設定檔",
    showFilter: "顯示篩選",
    filter: "篩選隊列與檢視",
    filterPlaceholder: "篩選",
    clearFilter: "清除篩選",
    palette: "命令面板",
    sectionOps: "OPS",
    pinned: "已釘選",
    noPins: "沒有釘選項目",
    lenses: "檢視",
    pin: "釘選",
    unpin: "取消釘選",
    pinItem: value => `釘選 ${value}`,
    unpinItem: value => `取消釘選 ${value}`,
    more: "更多",
    needsYou: "需要你",
    connect: "+ 連線",
    settings: "設定",
    fleet: "隊列",
    idleCount: value => `${value} 個閒置`,
    online: value => `${value} 在線`
  },
  chrome: {
    breadcrumb: "Ops 導覽路徑",
    searchOps: "搜尋 Ops",
    toggleRail: "切換側欄",
    toggleDock: "切換停駐欄",
    toggleInspector: "切換檢查器",
    focusedRun: value => `執行 #${value}`,
    working: value => `${value} 個工作中`,
    needsYou: value => `${value} 個需要你`,
    tokens: value => `${value} 權杖`,
    workingSource: "最新的 A1 隊列觀測",
    needsYouSource: "最新的 A1/A3 隊列觀測",
    gatewaySource: "/api/status 閘道狀態 + 後端版本 · 固定擁有者",
    dock: "停駐欄",
    dockOpen: "停駐欄已開啟",
    problems: value => `問題 ${value}`
  },
  toolbar: {
    back: "← 聊天",
    rail: "側欄",
    inspector: "檢查器",
    dock: "停駐欄",
    copyLink: "複製連結",
    restoreSplit: "還原分割",
    fullScreen: "全螢幕 Ops",
    openChat: "開啟現有聊天"
  },
  reasons: {
    modelEdit: "在 A5/A6 之前無法編輯",
    mutation: "在 A5/A6 寫入可用之前無法使用",
    approve: "沒有快捷鍵會核准。「前往下一個核准」只移動焦點。"
  },
  palette: {
    recent: "最近搜尋",
    group: "Ops",
    commands: {
      "go-office": "前往辦公室",
      "go-canvas": "前往畫布",
      "go-board": "前往看板",
      "go-runs": "前往執行",
      "go-skills": "前往技能",
      settings: "設定",
      "switch-theme": "切換主題",
      "shortcut-sheet": "快捷鍵表",
      "focus-next-approval": "前往下一個核准",
      "create-task": "建立任務",
      "create-project": "建立專案",
      approve: "核准",
      "set-model": "設定模型",
      restore: "還原設定檔"
    }
  },
  shortcuts: {
    title: "Ops 快捷鍵",
    description: "Ctrl+J 仍是桌面側邊欄。在標題列或狀態列中切換停駐欄。沒有快捷鍵會核准未檢視的內容。",
    close: "關閉",
    actions: {
      goOffice: "辦公室",
      goCanvas: "畫布",
      goBoard: "看板",
      goRuns: "執行",
      goSkills: "技能",
      create: "聚焦建立區域。不會建立任務。",
      filter: "側欄篩選",
      sheet: "快捷鍵表",
      edit: "編輯目前聚焦的 Ops 物件",
      rail: "切換側欄",
      inspector: "切換檢查器",
      move: "移動選取",
      open: "開啟聚焦的列。不會核准。",
      closeTab: "關閉目前未釘選的 Ops 分頁。絕不關閉視窗。",
      cycleTabs: "循環切換 Ops 文件分頁",
      history: "分頁歷史",
      settings: "Ops 設定",
      search: "在現有命令面板中搜尋 Ops",
      escape: "關閉最內層，然後退出全螢幕"
    }
  },
  inspector: {
    label: "檢查器",
    close: "關閉檢查器",
    slots: {
      fleet: "隊列",
      context: "脈絡",
      task: "任務",
      node: "節點",
      history: "歷史",
      events: "事件",
      row: "列"
    },
    selection: "選取項目",
    detailUnavailable: value => `${value} 中尚未選取任何內容。選取一項即可在此檢視詳細資料。`,
    fields: inspectorFields('zh-hant'),
    runEventsEmpty: "在聚焦的執行提供事件之前，執行事件保持空白。"
  },
  dock: {
    label: "Ops 停駐欄",
    close: "關閉停駐欄",
    slots: {
      log: "日誌",
      events: "事件",
      problems: "問題"
    },
    noLog: "沒有日誌行",
    noEvents: "沒有事件",
    problemsUnavailable: "無法取得問題",
    noProblems: "沒有問題"
  },
  tabs: {
    label: "Ops 分頁",
    labelActive: value => `Ops 分頁，${value}`,
    close: value => `關閉 ${value}`,
    more: value => `更多分頁，溢出 ${value} 個`,
    pin: value => `釘選 ${value}`,
    unpin: value => `取消釘選 ${value}`,
    noRoute: value => `${value} 沒有桌面路由。此外殼不會憑空建立。`
  },
  toast: {
    open: "開啟",
    undo: "復原",
    moreNeedsYou: value => `+${value} 個更多 → 需要你`,
    kinds: {
      move: "移動",
      archive: "封存",
      reassign: "重新指派",
      approval: "核准",
      blocked: "已封鎖",
      stop: "停止"
    },
    dismiss: value => `關閉 ${value}`
  },
  table: {
    caption: "表格",
    empty: "沒有資料列",
    sortBy: value => `依 ${value} 排序`
  },
  node: {
    edit: "編輯",
    port: value => `連接埠 ${value}`
  },
  motion: {
    rowDescription: "狀態仍會變化並保持可讀"
  },
  why: {
    prefix: "原因 · 用途：",
    observed: value => `觀測於 ${value}`,
    missingReason: "未記錄原因"
  }
}

const opsStatesZhHant: OpsStatesCopy = {
  empty: {
    title: "尚無內容",
    explanation: "資料來源已回應，但此檢視沒有項目。",
    action: "重新整理"
  },
  loading: {
    title: "載入中",
    explanation: "正在從其自身資料來源取得此檢視。其他檢視照常運作。",
    action: "立即重試"
  },
  reconnecting: {
    title: "正在重新連線",
    explanation: "資料來源停止回應。正在自動重試；最後的快照仍保持可見。",
    action: "立即重新連線"
  },
  stale: {
    title: "顯示最後的快照",
    explanation: "此資料已超過其新鮮度期限。在重新整理成功之前保持可讀。",
    action: "重新整理"
  },
  exhausted: {
    title: "已停止重試",
    explanation: "自動重試已達上限。在你要求之前不會再次重試。",
    action: "重試"
  },
  auth: {
    title: "身分驗證失敗",
    explanation: "資料來源拒絕了憑證（401/403）。在重新登入之前重試無濟於事。",
    action: "重新登入"
  },
  capability: {
    title: "此連線無法使用",
    explanation: "此後端未提供此檢視所需的功能。這不是暫時性故障。",
    action: "檢視需求"
  },
  crashed: {
    title: "此檢視轉譯失敗",
    explanation: "只有此檢視停止了。頁面其餘部分照常運作。",
    action: "重新載入檢視"
  },
  source: value => `來源：${value}`,
  sourceUnknown: "來源：未記錄",
  updated: value => `更新於 ${value}`,
  neverUpdated: "從未更新",
  attempt: (a, b) => `第 ${a} 次嘗試，共 ${b} 次`,
  capabilityName: value => `需要：${value}`,
  writesDisabled: "在此檢視更新為最新之前，變更已停用。"
}

const opsJa: OpsCopy = {
  brand: "Ops",
  unavailable: "利用不可",
  unknown: "不明",
  readOnly: "読み取り専用",
  presence: {
    working: "作業中",
    needs_you: "要対応",
    blocked: "ブロック中",
    idle: "待機中",
    offline: "オフライン",
    unknown: "不明",
    done: "完了",
    stale: "古い"
  },
  shapes: {
    disc: "塗りつぶしの円",
    "reduced-disc": "縁取り付きの塗りつぶしの円",
    ringed: "リング付きの円",
    triangle: "三角形",
    dot: "中黒",
    hollow: "中抜きの円",
    dotted: "点線の円",
    barred: "斜線入りの円",
    "static-disc": "静止した円"
  },
  nav: {
    runs: "実行",
    review: "レビュー",
    templates: "テンプレート",
    projects: "プロジェクト",
    files: "ファイル",
    conversations: "会話",
    skills: "スキル",
    channels: "チャンネルと MCP",
    activity: "アクティビティ",
    triggers: "トリガー",
    schedule: "スケジュール",
    memory: "メモリー",
    profiles: "プロファイル",
    agents: "エージェント",
    office: "オフィス",
    canvas: "キャンバス",
    board: "ボード"
  },
  rail: {
    label: "Ops",
    switcher: "接続とプロファイル",
    connection: "接続",
    profile: "プロファイル",
    showFilter: "フィルターを表示",
    filter: "フリートとレンズを絞り込む",
    filterPlaceholder: "フィルター",
    clearFilter: "フィルターをクリア",
    palette: "パレット",
    sectionOps: "OPS",
    pinned: "ピン留め",
    noPins: "ピン留めなし",
    lenses: "レンズ",
    pin: "ピン留め",
    unpin: "ピン留め解除",
    pinItem: value => `${value} をピン留め`,
    unpinItem: value => `${value} のピン留めを解除`,
    more: "その他",
    needsYou: "要対応",
    connect: "+ 接続",
    settings: "設定",
    fleet: "フリート",
    idleCount: value => `${value} 件待機中`,
    online: value => `${value} オンライン`
  },
  chrome: {
    breadcrumb: "Ops のパンくずリスト",
    searchOps: "Ops を検索",
    toggleRail: "レールを切り替え",
    toggleDock: "ドックを切り替え",
    toggleInspector: "インスペクターを切り替え",
    focusedRun: value => `実行 #${value}`,
    working: value => `${value} 件作業中`,
    needsYou: value => `${value} 件要対応`,
    tokens: value => `${value} トークン`,
    workingSource: "最新の A1 フリート観測",
    needsYouSource: "最新の A1/A3 フリート観測",
    gatewaySource: "/api/status のゲートウェイ状態 + バックエンドのバージョン · 固定オーナー",
    dock: "ドック",
    dockOpen: "ドックを表示中",
    problems: value => `問題 ${value}`
  },
  toolbar: {
    back: "← チャット",
    rail: "レール",
    inspector: "インスペクター",
    dock: "ドック",
    copyLink: "リンクをコピー",
    restoreSplit: "分割を元に戻す",
    fullScreen: "Ops を全画面表示",
    openChat: "既存のチャットを開く"
  },
  reasons: {
    modelEdit: "A5/A6 までは編集できません",
    mutation: "A5/A6 の書き込みが実装されるまで利用できません",
    approve: "承認するショートカットはありません。「次の承認へ移動」はフォーカスを移すだけです。"
  },
  palette: {
    recent: "最近の検索",
    group: "Ops",
    commands: {
      "go-office": "オフィスへ移動",
      "go-canvas": "キャンバスへ移動",
      "go-board": "ボードへ移動",
      "go-runs": "実行へ移動",
      "go-skills": "スキルへ移動",
      settings: "設定",
      "switch-theme": "テーマを切り替え",
      "shortcut-sheet": "ショートカット一覧",
      "focus-next-approval": "次の承認へ移動",
      "create-task": "タスクを作成",
      "create-project": "プロジェクトを作成",
      approve: "承認",
      "set-model": "モデルを設定",
      restore: "プロファイルを復元"
    }
  },
  shortcuts: {
    title: "Ops のショートカット",
    description: "Ctrl+J は引き続きデスクトップのサイドバーです。ドックはタイトルバーまたはステータスバーで切り替えます。未確認の内容を承認するショートカットはありません。",
    close: "閉じる",
    actions: {
      goOffice: "オフィス",
      goCanvas: "キャンバス",
      goBoard: "ボード",
      goRuns: "実行",
      goSkills: "スキル",
      create: "作成エリアにフォーカスします。タスクは作成しません。",
      filter: "レールのフィルター",
      sheet: "ショートカット一覧",
      edit: "フォーカス中の Ops オブジェクトを編集",
      rail: "レールを切り替え",
      inspector: "インスペクターを切り替え",
      move: "選択を移動",
      open: "フォーカス中の行を開きます。承認はしません。",
      closeTab: "アクティブなピン留めされていない Ops タブを閉じます。ウィンドウは閉じません。",
      cycleTabs: "Ops のドキュメントタブを切り替え",
      history: "タブ履歴",
      settings: "Ops の設定",
      search: "既存のパレットで Ops を検索",
      escape: "最も内側のレイヤーを閉じ、その後全画面を終了"
    }
  },
  inspector: {
    label: "インスペクター",
    close: "インスペクターを閉じる",
    slots: {
      fleet: "フリート",
      context: "コンテキスト",
      task: "タスク",
      node: "ノード",
      history: "履歴",
      events: "イベント",
      row: "行"
    },
    selection: "選択項目",
    detailUnavailable: value => `${value} ではまだ何も選択されていません。項目を選択するとここに詳細が表示されます。`,
    fields: inspectorFields('ja'),
    runEventsEmpty: "フォーカス中の実行がイベントを提供するまで、実行イベントは空のままです。"
  },
  dock: {
    label: "Ops ドック",
    close: "ドックを閉じる",
    slots: {
      log: "ログ",
      events: "イベント",
      problems: "問題"
    },
    noLog: "ログ行はありません",
    noEvents: "イベントはありません",
    problemsUnavailable: "問題を取得できません",
    noProblems: "問題はありません"
  },
  tabs: {
    label: "Ops タブ",
    labelActive: value => `Ops タブ、${value}`,
    close: value => `${value} を閉じる`,
    more: value => `その他のタブ（${value} 件）`,
    pin: value => `${value} をピン留め`,
    unpin: value => `${value} のピン留めを解除`,
    noRoute: value => `${value} のデスクトップルートはありません。このシェルは作り出しません。`
  },
  toast: {
    open: "開く",
    undo: "元に戻す",
    moreNeedsYou: value => `ほか ${value} 件 → 要対応`,
    kinds: {
      move: "移動",
      archive: "アーカイブ",
      reassign: "再割り当て",
      approval: "承認",
      blocked: "ブロック中",
      stop: "停止"
    },
    dismiss: value => `${value} を閉じる`
  },
  table: {
    caption: "表",
    empty: "行はありません",
    sortBy: value => `${value} で並べ替え`
  },
  node: {
    edit: "編集",
    port: value => `ポート ${value}`
  },
  motion: {
    rowDescription: "状態は変化し、読みやすいままです"
  },
  why: {
    prefix: "理由 · 目的:",
    observed: value => `観測: ${value}`,
    missingReason: "理由は記録されていません"
  }
}

const opsStatesJa: OpsStatesCopy = {
  empty: {
    title: "まだ何もありません",
    explanation: "ソースは応答しましたが、このビューの項目はありません。",
    action: "更新"
  },
  loading: {
    title: "読み込み中",
    explanation: "このビューを専用のソースから取得しています。他のビューは引き続き動作します。",
    action: "今すぐ再試行"
  },
  reconnecting: {
    title: "再接続中",
    explanation: "ソースが応答しなくなりました。自動で再試行しています。最後のスナップショットは表示されたままです。",
    action: "今すぐ再接続"
  },
  stale: {
    title: "最後のスナップショットを表示中",
    explanation: "このデータは鮮度の上限を過ぎています。更新が成功するまで読める状態で保持されます。",
    action: "更新"
  },
  exhausted: {
    title: "再試行を停止しました",
    explanation: "自動再試行が上限に達しました。指示するまで再試行しません。",
    action: "もう一度試す"
  },
  auth: {
    title: "認証に失敗しました",
    explanation: "ソースが資格情報を拒否しました（401/403）。再度サインインするまで再試行しても解決しません。",
    action: "再度サインイン"
  },
  capability: {
    title: "この接続では利用できません",
    explanation: "このバックエンドはこのビューに必要な機能を提供していません。一時的な障害ではありません。",
    action: "要件を表示"
  },
  crashed: {
    title: "このビューの描画に失敗しました",
    explanation: "停止したのはこのビューだけです。ページの他の部分は引き続き動作します。",
    action: "ビューを再読み込み"
  },
  source: value => `ソース: ${value}`,
  sourceUnknown: "ソース: 未記録",
  updated: value => `更新: ${value}`,
  neverUpdated: "未更新",
  attempt: (a, b) => `${b} 回中 ${a} 回目`,
  capabilityName: value => `必要: ${value}`,
  writesDisabled: "このビューが最新になるまで変更は無効です。"
}

const opsAr: OpsCopy = {
  brand: "Ops",
  unavailable: "غير متاح",
  unknown: "غير معروف",
  readOnly: "للقراءة فقط",
  presence: {
    working: "يعمل",
    needs_you: "يحتاجك",
    blocked: "محظور",
    idle: "خامل",
    offline: "غير متصل",
    unknown: "غير معروف",
    done: "مكتمل",
    stale: "قديم"
  },
  shapes: {
    disc: "قرص ممتلئ",
    "reduced-disc": "قرص ممتلئ بحد ملاصق",
    ringed: "قرص بحلقة",
    triangle: "مثلث",
    dot: "نقطة وسطى",
    hollow: "قرص مجوف",
    dotted: "دائرة منقطة",
    barred: "دائرة مشطوبة",
    "static-disc": "قرص ثابت"
  },
  nav: {
    runs: "التشغيلات",
    review: "المراجعة",
    templates: "القوالب",
    projects: "المشاريع",
    files: "الملفات",
    conversations: "المحادثات",
    skills: "المهارات",
    channels: "القنوات و MCP",
    activity: "النشاط",
    triggers: "المشغلات",
    schedule: "الجدولة",
    memory: "الذاكرة",
    profiles: "الملفات الشخصية",
    agents: "الوكلاء",
    office: "المكتب",
    canvas: "اللوحة",
    board: "اللوح"
  },
  rail: {
    label: "Ops",
    switcher: "الاتصال والملف الشخصي",
    connection: "الاتصال",
    profile: "الملف الشخصي",
    showFilter: "إظهار عامل التصفية",
    filter: "تصفية الأسطول والعدسات",
    filterPlaceholder: "تصفية",
    clearFilter: "مسح عامل التصفية",
    palette: "لوحة الأوامر",
    sectionOps: "OPS",
    pinned: "المثبتة",
    noPins: "لا توجد عناصر مثبتة",
    lenses: "العدسات",
    pin: "تثبيت",
    unpin: "إلغاء التثبيت",
    pinItem: value => `تثبيت ${value}`,
    unpinItem: value => `إلغاء تثبيت ${value}`,
    more: "المزيد",
    needsYou: "يحتاجك",
    connect: "+ اتصال",
    settings: "الإعدادات",
    fleet: "الأسطول",
    idleCount: value => `${value} خامل`,
    online: value => `${value} متصل`
  },
  chrome: {
    breadcrumb: "مسار تنقل Ops",
    searchOps: "بحث في Ops",
    toggleRail: "تبديل الشريط الجانبي",
    toggleDock: "تبديل اللوحة السفلية",
    toggleInspector: "تبديل المفتش",
    focusedRun: value => `تشغيل #${value}`,
    working: value => `${value} يعمل`,
    needsYou: value => `${value} يحتاجك`,
    tokens: value => `${value} رمز`,
    workingSource: "رصد حديث للأسطول A1",
    needsYouSource: "رصد حديث للأسطول A1/A3",
    gatewaySource: "/api/status حالة البوابة + إصدار الخادم · مالك مثبت",
    dock: "اللوحة السفلية",
    dockOpen: "اللوحة السفلية مفتوحة",
    problems: value => `المشكلات ${value}`
  },
  toolbar: {
    back: "→ المحادثات",
    rail: "الشريط الجانبي",
    inspector: "المفتش",
    dock: "اللوحة السفلية",
    copyLink: "نسخ الرابط",
    restoreSplit: "استعادة التقسيم",
    fullScreen: "Ops بملء الشاشة",
    openChat: "فتح المحادثة الحالية"
  },
  reasons: {
    modelEdit: "التحرير غير متاح حتى A5/A6",
    mutation: "غير متاح حتى تتوفر عمليات الكتابة A5/A6",
    approve: "لا يوجد اختصار يوافق. «الانتقال إلى الموافقة التالية» ينقل التركيز فقط."
  },
  palette: {
    recent: "عمليات البحث الأخيرة",
    group: "Ops",
    commands: {
      "go-office": "الانتقال إلى المكتب",
      "go-canvas": "الانتقال إلى اللوحة",
      "go-board": "الانتقال إلى اللوح",
      "go-runs": "الانتقال إلى التشغيلات",
      "go-skills": "الانتقال إلى المهارات",
      settings: "الإعدادات",
      "switch-theme": "تبديل السمة",
      "shortcut-sheet": "قائمة الاختصارات",
      "focus-next-approval": "الانتقال إلى الموافقة التالية",
      "create-task": "إنشاء مهمة",
      "create-project": "إنشاء مشروع",
      approve: "موافقة",
      "set-model": "تعيين النموذج",
      restore: "استعادة الملف الشخصي"
    }
  },
  shortcuts: {
    title: "اختصارات Ops",
    description: "يبقى Ctrl+J للشريط الجانبي لسطح المكتب. بدّل اللوحة السفلية من شريط العنوان أو شريط الحالة. لا يوجد اختصار يوافق على محتوى لم تره.",
    close: "إغلاق",
    actions: {
      goOffice: "المكتب",
      goCanvas: "اللوحة",
      goBoard: "اللوح",
      goRuns: "التشغيلات",
      goSkills: "المهارات",
      create: "ينقل التركيز إلى منطقة الإنشاء. لا ينشئ مهمة.",
      filter: "تصفية الشريط الجانبي",
      sheet: "قائمة الاختصارات",
      edit: "تحرير عنصر Ops المحدد",
      rail: "تبديل الشريط الجانبي",
      inspector: "تبديل المفتش",
      move: "نقل التحديد",
      open: "يفتح الصف المحدد. لا يوافق.",
      closeTab: "يغلق علامة تبويب Ops النشطة غير المثبتة. لا يغلق النافذة أبدًا.",
      cycleTabs: "التنقل بين علامات تبويب مستندات Ops",
      history: "سجل علامات التبويب",
      settings: "إعدادات Ops",
      search: "البحث في Ops من لوحة الأوامر الحالية",
      escape: "يغلق الطبقة الداخلية ثم وضع ملء الشاشة"
    }
  },
  inspector: {
    label: "المفتش",
    close: "إغلاق المفتش",
    slots: {
      fleet: "الأسطول",
      context: "السياق",
      task: "المهمة",
      node: "العقدة",
      history: "السجل",
      events: "الأحداث",
      row: "الصف"
    },
    selection: "التحديد",
    detailUnavailable: value => `لم يُحدَّد شيء في ${value} بعد. اختر عنصرًا لعرض تفاصيله هنا.`,
    fields: inspectorFields('ar'),
    runEventsEmpty: "تبقى أحداث التشغيل فارغة حتى يوفرها تشغيل محدد."
  },
  dock: {
    label: "اللوحة السفلية لـ Ops",
    close: "إغلاق اللوحة السفلية",
    slots: {
      log: "السجل",
      events: "الأحداث",
      problems: "المشكلات"
    },
    noLog: "لا توجد أسطر سجل",
    noEvents: "لا توجد أحداث",
    problemsUnavailable: "المشكلات غير متاحة",
    noProblems: "لا توجد مشكلات"
  },
  tabs: {
    label: "علامات تبويب Ops",
    labelActive: value => `علامات تبويب Ops، ${value}`,
    close: value => `إغلاق ${value}`,
    more: value => `المزيد من علامات التبويب، ${value} إضافية`,
    pin: value => `تثبيت ${value}`,
    unpin: value => `إلغاء تثبيت ${value}`,
    noRoute: value => `لا يوجد مسار سطح مكتب لـ ${value}. هذا الغلاف لا يخترع مسارًا.`
  },
  toast: {
    open: "فتح",
    undo: "تراجع",
    moreNeedsYou: value => `+${value} أخرى ← يحتاجك`,
    kinds: {
      move: "نقل",
      archive: "أرشفة",
      reassign: "إعادة تعيين",
      approval: "موافقة",
      blocked: "محظور",
      stop: "إيقاف"
    },
    dismiss: value => `تجاهل ${value}`
  },
  table: {
    caption: "جدول",
    empty: "لا توجد صفوف",
    sortBy: value => `فرز حسب ${value}`
  },
  node: {
    edit: "تحرير",
    port: value => `المنفذ ${value}`
  },
  motion: {
    rowDescription: "تتغير الحالات وتبقى مقروءة"
  },
  why: {
    prefix: "السبب · الغرض:",
    observed: value => `رُصد ${value}`,
    missingReason: "لم يُسجَّل السبب"
  }
}

const opsStatesAr: OpsStatesCopy = {
  empty: {
    title: "لا يوجد شيء بعد",
    explanation: "استجاب المصدر ولا توجد عناصر لهذا العرض.",
    action: "تحديث"
  },
  loading: {
    title: "جارٍ التحميل",
    explanation: "جارٍ جلب هذا العرض من مصدره الخاص. تستمر طرق العرض الأخرى في العمل.",
    action: "إعادة المحاولة الآن"
  },
  reconnecting: {
    title: "جارٍ إعادة الاتصال",
    explanation: "توقف المصدر عن الاستجابة. تتم إعادة المحاولة تلقائيًا؛ وتبقى آخر لقطة ظاهرة.",
    action: "إعادة الاتصال الآن"
  },
  stale: {
    title: "عرض آخر لقطة",
    explanation: "هذه البيانات أقدم من حد حداثتها. تبقى مقروءة حتى ينجح التحديث.",
    action: "تحديث"
  },
  exhausted: {
    title: "توقفت إعادة المحاولة",
    explanation: "بلغت إعادة المحاولة التلقائية حدها. لن تتم إعادة المحاولة حتى تطلب ذلك.",
    action: "حاول مرة أخرى"
  },
  auth: {
    title: "فشلت المصادقة",
    explanation: "رفض المصدر بيانات الاعتماد (401/403). لن تفيد إعادة المحاولة حتى تسجّل الدخول مجددًا.",
    action: "تسجيل الدخول مجددًا"
  },
  capability: {
    title: "غير متاح على هذا الاتصال",
    explanation: "لا يوفّر هذا الخادم القدرة التي يحتاجها هذا العرض. هذا ليس عطلًا مؤقتًا.",
    action: "عرض المتطلبات"
  },
  crashed: {
    title: "تعذّر عرض هذا العرض",
    explanation: "توقف هذا العرض فقط. يستمر باقي الصفحة في العمل.",
    action: "إعادة تحميل العرض"
  },
  source: value => `المصدر: ${value}`,
  sourceUnknown: "المصدر: غير مسجّل",
  updated: value => `حُدِّث ${value}`,
  neverUpdated: "لم يُحدَّث قط",
  attempt: (a, b) => `المحاولة ${a} من ${b}`,
  capabilityName: value => `يتطلب: ${value}`,
  writesDisabled: "التغييرات معطّلة حتى يصبح هذا العرض محدّثًا."
}

const opsRu: OpsCopy = {
  brand: "Ops",
  unavailable: "недоступно",
  unknown: "неизвестно",
  readOnly: "только чтение",
  presence: {
    working: "работает",
    needs_you: "нужны вы",
    blocked: "заблокировано",
    idle: "простаивает",
    offline: "не в сети",
    unknown: "неизвестно",
    done: "готово",
    stale: "устарело"
  },
  shapes: {
    disc: "закрашенный круг",
    "reduced-disc": "закрашенный круг с обводкой",
    ringed: "круг с кольцом",
    triangle: "треугольник",
    dot: "точка",
    hollow: "пустой круг",
    dotted: "пунктирный круг",
    barred: "перечёркнутый круг",
    "static-disc": "статичный круг"
  },
  nav: {
    runs: "Запуски",
    review: "Проверка",
    templates: "Шаблоны",
    projects: "Проекты",
    files: "Файлы",
    conversations: "Беседы",
    skills: "Навыки",
    channels: "Каналы и MCP",
    activity: "Активность",
    triggers: "Триггеры",
    schedule: "Расписание",
    memory: "Память",
    profiles: "Профили",
    agents: "Агенты",
    office: "Офис",
    canvas: "Холст",
    board: "Доска"
  },
  rail: {
    label: "Ops",
    switcher: "Подключение и профиль",
    connection: "Подключение",
    profile: "Профиль",
    showFilter: "Показать фильтр",
    filter: "Фильтр по парку и линзам",
    filterPlaceholder: "Фильтр",
    clearFilter: "Сбросить фильтр",
    palette: "Палитра",
    sectionOps: "OPS",
    pinned: "Закреплённые",
    noPins: "Нет закреплённых",
    lenses: "ЛИНЗЫ",
    pin: "Закрепить",
    unpin: "Открепить",
    pinItem: value => `Закрепить ${value}`,
    unpinItem: value => `Открепить ${value}`,
    more: "Ещё",
    needsYou: "Нужны вы",
    connect: "+ Подключить",
    settings: "Настройки",
    fleet: "ПАРК",
    idleCount: value => `простаивает: ${value}`,
    online: value => `${value} в сети`
  },
  chrome: {
    breadcrumb: "Навигационная цепочка Ops",
    searchOps: "Поиск в Ops",
    toggleRail: "Переключить панель",
    toggleDock: "Переключить док",
    toggleInspector: "Переключить инспектор",
    focusedRun: value => `запуск #${value}`,
    working: value => `работает: ${value}`,
    needsYou: value => `ждут вас: ${value}`,
    tokens: value => `${value} ток.`,
    workingSource: "Свежее наблюдение парка A1",
    needsYouSource: "Свежее наблюдение парка A1/A3",
    gatewaySource: "/api/status состояние шлюза + версия бэкенда · закреплённый владелец",
    dock: "Док",
    dockOpen: "Док открыт",
    problems: value => `Проблемы: ${value}`
  },
  toolbar: {
    back: "← Чаты",
    rail: "Панель",
    inspector: "Инспектор",
    dock: "Док",
    copyLink: "Копировать ссылку",
    restoreSplit: "Вернуть разделение",
    fullScreen: "Ops на весь экран",
    openChat: "Открыть текущий чат"
  },
  reasons: {
    modelEdit: "Редактирование недоступно до A5/A6",
    mutation: "Недоступно, пока нет записи A5/A6",
    approve: "Ни одно сочетание не подтверждает. «К следующему подтверждению» только перемещает фокус."
  },
  palette: {
    recent: "Недавние запросы",
    group: "Ops",
    commands: {
      "go-office": "Перейти в офис",
      "go-canvas": "Перейти к холсту",
      "go-board": "Перейти к доске",
      "go-runs": "Перейти к запускам",
      "go-skills": "Перейти к навыкам",
      settings: "Настройки",
      "switch-theme": "Сменить тему",
      "shortcut-sheet": "Список сочетаний",
      "focus-next-approval": "К следующему подтверждению",
      "create-task": "Создать задачу",
      "create-project": "Создать проект",
      approve: "Подтвердить",
      "set-model": "Выбрать модель",
      restore: "Восстановить профиль"
    }
  },
  shortcuts: {
    title: "Сочетания клавиш Ops",
    description: "Ctrl+J по-прежнему открывает боковую панель Desktop. Док переключается в заголовке или строке состояния. Ни одно сочетание не подтверждает непросмотренное содержимое.",
    close: "Закрыть",
    actions: {
      goOffice: "Офис",
      goCanvas: "Холст",
      goBoard: "Доска",
      goRuns: "Запуски",
      goSkills: "Навыки",
      create: "Фокус на области создания. Задачу не создаёт.",
      filter: "Фильтр панели",
      sheet: "Список сочетаний",
      edit: "Изменить выбранный объект Ops",
      rail: "Переключить панель",
      inspector: "Переключить инспектор",
      move: "Переместить выделение",
      open: "Открыть выбранную строку. Не подтверждает.",
      closeTab: "Закрыть активную незакреплённую вкладку Ops. Никогда не закрывает окно.",
      cycleTabs: "Переключать вкладки документов Ops",
      history: "История вкладок",
      settings: "Настройки Ops",
      search: "Поиск в Ops через существующую палитру",
      escape: "Закрыть внутренний слой, затем полноэкранный режим"
    }
  },
  inspector: {
    label: "Инспектор",
    close: "Закрыть инспектор",
    slots: {
      fleet: "Парк",
      context: "Контекст",
      task: "Задача",
      node: "Узел",
      history: "История",
      events: "События",
      row: "Строка"
    },
    selection: "Выбранное",
    detailUnavailable: value => `В разделе ${value} пока ничего не выбрано. Выберите элемент, чтобы увидеть подробности здесь.`,
    fields: inspectorFields('ru'),
    runEventsEmpty: "События запуска пусты, пока их не передаст выбранный запуск."
  },
  dock: {
    label: "Док Ops",
    close: "Закрыть док",
    slots: {
      log: "Журнал",
      events: "События",
      problems: "Проблемы"
    },
    noLog: "Нет строк журнала",
    noEvents: "Нет событий",
    problemsUnavailable: "Проблемы недоступны",
    noProblems: "Нет проблем"
  },
  tabs: {
    label: "Вкладки Ops",
    labelActive: value => `Вкладки Ops, ${value}`,
    close: value => `Закрыть ${value}`,
    more: value => `Ещё вкладки: ${value}`,
    pin: value => `Закрепить ${value}`,
    unpin: value => `Открепить ${value}`,
    noRoute: value => `Для ${value} нет маршрута Desktop. Оболочка его не выдумывает.`
  },
  toast: {
    open: "Открыть",
    undo: "Отменить",
    moreNeedsYou: value => `ещё ${value} → Нужны вы`,
    kinds: {
      move: "перемещение",
      archive: "архивирование",
      reassign: "переназначение",
      approval: "подтверждение",
      blocked: "заблокировано",
      stop: "остановка"
    },
    dismiss: value => `Скрыть ${value}`
  },
  table: {
    caption: "Таблица",
    empty: "Нет строк",
    sortBy: value => `Сортировать по ${value}`
  },
  node: {
    edit: "Изменить",
    port: value => `порт ${value}`
  },
  motion: {
    rowDescription: "Состояния меняются и остаются читаемыми"
  },
  why: {
    prefix: "зачем · для чего:",
    observed: value => `наблюдалось ${value}`,
    missingReason: "причина не записана"
  }
}

const opsStatesRu: OpsStatesCopy = {
  empty: {
    title: "Пока ничего нет",
    explanation: "Источник ответил, но элементов для этого представления нет.",
    action: "Обновить"
  },
  loading: {
    title: "Загрузка",
    explanation: "Загружаем это представление из его источника. Остальные продолжают работать.",
    action: "Повторить сейчас"
  },
  reconnecting: {
    title: "Переподключение",
    explanation: "Источник перестал отвечать. Повторяем автоматически; последний снимок остаётся на экране.",
    action: "Переподключиться"
  },
  stale: {
    title: "Показан последний снимок",
    explanation: "Данные старше допустимого срока. Они остаются читаемыми, пока обновление не пройдёт.",
    action: "Обновить"
  },
  exhausted: {
    title: "Повторы остановлены",
    explanation: "Автоматические повторы исчерпаны. Ничего не повторится, пока вы не попросите.",
    action: "Попробовать снова"
  },
  auth: {
    title: "Ошибка аутентификации",
    explanation: "Источник отклонил учётные данные (401/403). Повторы не помогут, пока вы не войдёте снова.",
    action: "Войти снова"
  },
  capability: {
    title: "Недоступно для этого подключения",
    explanation: "Этот бэкенд не предоставляет нужную возможность. Это не временный сбой.",
    action: "Показать требования"
  },
  crashed: {
    title: "Не удалось отобразить представление",
    explanation: "Остановилось только это представление. Остальная страница работает.",
    action: "Перезагрузить"
  },
  source: value => `Источник: ${value}`,
  sourceUnknown: "Источник: не записан",
  updated: value => `Обновлено ${value}`,
  neverUpdated: "Не обновлялось",
  attempt: (a, b) => `Попытка ${a} из ${b}`,
  capabilityName: value => `Требуется: ${value}`,
  writesDisabled: "Изменения отключены, пока представление не актуально."
}

const opsFr: OpsCopy = {
  brand: "Ops",
  unavailable: "indisponible",
  unknown: "inconnu",
  readOnly: "lecture seule",
  presence: {
    working: "en cours",
    needs_you: "vous attend",
    blocked: "bloqué",
    idle: "inactif",
    offline: "hors ligne",
    unknown: "inconnu",
    done: "terminé",
    stale: "périmé"
  },
  shapes: {
    disc: "disque plein",
    "reduced-disc": "disque plein avec contour ajusté",
    ringed: "disque cerclé",
    triangle: "triangle",
    dot: "point médian",
    hollow: "disque creux",
    dotted: "cercle pointillé",
    barred: "cercle barré",
    "static-disc": "disque statique"
  },
  nav: {
    runs: "Exécutions",
    review: "Revue",
    templates: "Modèles",
    projects: "Projets",
    files: "Fichiers",
    conversations: "Conversations",
    skills: "Compétences",
    channels: "Canaux et MCP",
    activity: "Activité",
    triggers: "Déclencheurs",
    schedule: "Planification",
    memory: "Mémoire",
    profiles: "Profils",
    agents: "Agents",
    office: "Bureau",
    canvas: "Canevas",
    board: "Tableau"
  },
  rail: {
    label: "Ops",
    switcher: "Connexion et profil",
    connection: "Connexion",
    profile: "Profil",
    showFilter: "Afficher le filtre",
    filter: "Filtrer la flotte et les vues",
    filterPlaceholder: "Filtrer",
    clearFilter: "Effacer le filtre",
    palette: "Palette",
    sectionOps: "OPS",
    pinned: "Épinglés",
    noPins: "Aucun épinglé",
    lenses: "VUES",
    pin: "Épingler",
    unpin: "Désépingler",
    pinItem: value => `Épingler ${value}`,
    unpinItem: value => `Désépingler ${value}`,
    more: "Plus",
    needsYou: "Vous attend",
    connect: "+ Connecter",
    settings: "Paramètres",
    fleet: "FLOTTE",
    idleCount: value => (value === 1 ? '1 inactif' : `${value} inactifs`),
    online: value => `${value} en ligne`
  },
  chrome: {
    breadcrumb: "Fil d'Ariane Ops",
    searchOps: "Rechercher dans Ops",
    toggleRail: "Afficher/masquer le rail",
    toggleDock: "Afficher/masquer le dock",
    toggleInspector: "Afficher/masquer l'inspecteur",
    focusedRun: value => `exécution n° ${value}`,
    working: value => `${value} en cours`,
    needsYou: value => `${value} vous attendent`,
    tokens: value => `${value} jetons`,
    workingSource: "Observation récente de la flotte A1",
    needsYouSource: "Observation récente de la flotte A1/A3",
    gatewaySource: "/api/status état de la passerelle + version du backend · propriétaire épinglé",
    dock: "Dock",
    dockOpen: "Dock ouvert",
    problems: value => `Problèmes ${value}`
  },
  toolbar: {
    back: "← Discussions",
    rail: "Rail",
    inspector: "Inspecteur",
    dock: "Dock",
    copyLink: "Copier le lien",
    restoreSplit: "Restaurer la vue partagée",
    fullScreen: "Ops en plein écran",
    openChat: "Ouvrir la discussion existante"
  },
  reasons: {
    modelEdit: "Modification indisponible avant A5/A6",
    mutation: "Indisponible tant que les écritures A5/A6 n'existent pas",
    approve: "Aucun raccourci n'approuve. « Aller à l'approbation suivante » déplace seulement le focus."
  },
  palette: {
    recent: "Recherches récentes",
    group: "Ops",
    commands: {
      "go-office": "Aller au bureau",
      "go-canvas": "Aller au canevas",
      "go-board": "Aller au tableau",
      "go-runs": "Aller aux exécutions",
      "go-skills": "Aller aux compétences",
      settings: "Paramètres",
      "switch-theme": "Changer de thème",
      "shortcut-sheet": "Liste des raccourcis",
      "focus-next-approval": "Aller à l'approbation suivante",
      "create-task": "Créer une tâche",
      "create-project": "Créer un projet",
      approve: "Approuver",
      "set-model": "Définir le modèle",
      restore: "Restaurer le profil"
    }
  },
  shortcuts: {
    title: "Raccourcis Ops",
    description: "Ctrl+J reste la barre latérale de Desktop. Basculez le dock depuis la barre de titre ou la barre d'état. Aucun raccourci n'approuve un contenu non vu.",
    close: "Fermer",
    actions: {
      goOffice: "Bureau",
      goCanvas: "Canevas",
      goBoard: "Tableau",
      goRuns: "Exécutions",
      goSkills: "Compétences",
      create: "Place le focus sur la zone de création. Ne crée pas de tâche.",
      filter: "Filtre du rail",
      sheet: "Liste des raccourcis",
      edit: "Modifier l'objet Ops ciblé",
      rail: "Afficher/masquer le rail",
      inspector: "Afficher/masquer l'inspecteur",
      move: "Déplacer la sélection",
      open: "Ouvre la ligne ciblée. N'approuve pas.",
      closeTab: "Ferme l'onglet Ops actif non épinglé. Jamais la fenêtre.",
      cycleTabs: "Parcourir les onglets de documents Ops",
      history: "Historique des onglets",
      settings: "Paramètres Ops",
      search: "Rechercher dans Ops depuis la palette existante",
      escape: "Ferme la couche la plus interne, puis le plein écran"
    }
  },
  inspector: {
    label: "Inspecteur",
    close: "Fermer l'inspecteur",
    slots: {
      fleet: "Flotte",
      context: "Contexte",
      task: "Tâche",
      node: "Nœud",
      history: "Historique",
      events: "Événements",
      row: "Ligne"
    },
    selection: "Sélection",
    detailUnavailable: value => `Rien n'est encore sélectionné dans ${value}. Sélectionnez un élément pour voir son détail ici.`,
    fields: inspectorFields('fr'),
    runEventsEmpty: "Les événements d'exécution restent vides tant qu'une exécution ciblée ne les fournit pas."
  },
  dock: {
    label: "Dock Ops",
    close: "Fermer le dock",
    slots: {
      log: "Journal",
      events: "Événements",
      problems: "Problèmes"
    },
    noLog: "Aucune ligne de journal",
    noEvents: "Aucun événement",
    problemsUnavailable: "Problèmes indisponibles",
    noProblems: "Aucun problème"
  },
  tabs: {
    label: "Onglets Ops",
    labelActive: value => `Onglets Ops, ${value}`,
    close: value => `Fermer ${value}`,
    more: value => `Autres onglets, ${value} en trop`,
    pin: value => `Épingler ${value}`,
    unpin: value => `Désépingler ${value}`,
    noRoute: value => `Aucune route Desktop pour ${value}. Ce shell n'en invente pas.`
  },
  toast: {
    open: "Ouvrir",
    undo: "Annuler",
    moreNeedsYou: value => `+${value} de plus → Vous attend`,
    kinds: {
      move: "déplacement",
      archive: "archivage",
      reassign: "réattribution",
      approval: "approbation",
      blocked: "bloqué",
      stop: "arrêt"
    },
    dismiss: value => `Ignorer ${value}`
  },
  table: {
    caption: "Tableau",
    empty: "Aucune ligne",
    sortBy: value => `Trier par ${value}`
  },
  node: {
    edit: "Modifier",
    port: value => `port ${value}`
  },
  motion: {
    rowDescription: "Les états changent toujours et restent lisibles"
  },
  why: {
    prefix: "pourquoi · dans quel but :",
    observed: value => `observé ${value}`,
    missingReason: "raison non enregistrée"
  }
}

const opsStatesFr: OpsStatesCopy = {
  empty: {
    title: "Rien pour l'instant",
    explanation: "La source a répondu et n'a aucun élément pour cette vue.",
    action: "Actualiser"
  },
  loading: {
    title: "Chargement",
    explanation: "Récupération de cette vue depuis sa propre source. Les autres vues continuent de fonctionner.",
    action: "Réessayer maintenant"
  },
  reconnecting: {
    title: "Reconnexion",
    explanation: "La source ne répond plus. Nouvelle tentative automatique ; le dernier instantané reste visible.",
    action: "Se reconnecter maintenant"
  },
  stale: {
    title: "Dernier instantané affiché",
    explanation: "Ces données dépassent leur durée de fraîcheur. Elles restent lisibles jusqu'à une actualisation réussie.",
    action: "Actualiser"
  },
  exhausted: {
    title: "Tentatives arrêtées",
    explanation: "Les tentatives automatiques ont atteint leur limite. Rien ne sera retenté sans votre demande.",
    action: "Réessayer"
  },
  auth: {
    title: "Échec de l'authentification",
    explanation: "La source a refusé les identifiants (401/403). Réessayer ne servira à rien tant que vous ne vous reconnectez pas.",
    action: "Se reconnecter"
  },
  capability: {
    title: "Indisponible sur cette connexion",
    explanation: "Ce backend n'expose pas la capacité nécessaire à cette vue. Ce n'est pas une panne temporaire.",
    action: "Voir les prérequis"
  },
  crashed: {
    title: "Cette vue n'a pas pu s'afficher",
    explanation: "Seule cette vue s'est arrêtée. Le reste de la page continue de fonctionner.",
    action: "Recharger la vue"
  },
  source: value => `Source : ${value}`,
  sourceUnknown: "Source : non enregistrée",
  updated: value => `Mis à jour ${value}`,
  neverUpdated: "Jamais mis à jour",
  attempt: (a, b) => `Tentative ${a} sur ${b}`,
  capabilityName: value => `Requiert : ${value}`,
  writesDisabled: "Les modifications sont désactivées tant que cette vue n'est pas à jour."
}

const opsDe: OpsCopy = {
  brand: "Ops",
  unavailable: "nicht verfügbar",
  unknown: "unbekannt",
  readOnly: "schreibgeschützt",
  presence: {
    working: "arbeitet",
    needs_you: "braucht dich",
    blocked: "blockiert",
    idle: "untätig",
    offline: "offline",
    unknown: "unbekannt",
    done: "fertig",
    stale: "veraltet"
  },
  shapes: {
    disc: "gefüllter Kreis",
    "reduced-disc": "gefüllter Kreis mit anliegender Kontur",
    ringed: "Kreis mit Ring",
    triangle: "Dreieck",
    dot: "Mittelpunkt",
    hollow: "hohler Kreis",
    dotted: "gepunkteter Kreis",
    barred: "durchgestrichener Kreis",
    "static-disc": "statischer Kreis"
  },
  nav: {
    runs: "Läufe",
    review: "Prüfung",
    templates: "Vorlagen",
    projects: "Projekte",
    files: "Dateien",
    conversations: "Unterhaltungen",
    skills: "Fähigkeiten",
    channels: "Kanäle & MCP",
    activity: "Aktivität",
    triggers: "Auslöser",
    schedule: "Zeitplan",
    memory: "Gedächtnis",
    profiles: "Profile",
    agents: "Agenten",
    office: "Büro",
    canvas: "Leinwand",
    board: "Board"
  },
  rail: {
    label: "Ops",
    switcher: "Verbindung und Profil",
    connection: "Verbindung",
    profile: "Profil",
    showFilter: "Filter anzeigen",
    filter: "Flotte und Linsen filtern",
    filterPlaceholder: "Filtern",
    clearFilter: "Filter löschen",
    palette: "Palette",
    sectionOps: "OPS",
    pinned: "Angeheftet",
    noPins: "Keine angehefteten Elemente",
    lenses: "LINSEN",
    pin: "Anheften",
    unpin: "Lösen",
    pinItem: value => `${value} anheften`,
    unpinItem: value => `${value} lösen`,
    more: "Mehr",
    needsYou: "Braucht dich",
    connect: "+ Verbinden",
    settings: "Einstellungen",
    fleet: "FLOTTE",
    idleCount: value => `${value} untätig`,
    online: value => `${value} online`
  },
  chrome: {
    breadcrumb: "Ops-Brotkrumen",
    searchOps: "Ops durchsuchen",
    toggleRail: "Leiste umschalten",
    toggleDock: "Dock umschalten",
    toggleInspector: "Inspektor umschalten",
    focusedRun: value => `Lauf #${value}`,
    working: value => `${value} aktiv`,
    needsYou: value => `${value} brauchen dich`,
    tokens: value => `${value} Tok.`,
    workingSource: "Aktuelle A1-Flottenbeobachtung",
    needsYouSource: "Aktuelle A1/A3-Flottenbeobachtung",
    gatewaySource: "/api/status Gateway-Status + Backend-Version · fester Eigentümer",
    dock: "Dock",
    dockOpen: "Dock offen",
    problems: value => `Probleme ${value}`
  },
  toolbar: {
    back: "← Chats",
    rail: "Leiste",
    inspector: "Inspektor",
    dock: "Dock",
    copyLink: "Link kopieren",
    restoreSplit: "Teilung wiederherstellen",
    fullScreen: "Ops im Vollbild",
    openChat: "Bestehenden Chat öffnen"
  },
  reasons: {
    modelEdit: "Bearbeiten erst ab A5/A6 verfügbar",
    mutation: "Nicht verfügbar, bis A5/A6-Schreibzugriffe existieren",
    approve: "Kein Kürzel genehmigt. „Zur nächsten Genehmigung“ verschiebt nur den Fokus."
  },
  palette: {
    recent: "Letzte Suchen",
    group: "Ops",
    commands: {
      "go-office": "Zum Büro",
      "go-canvas": "Zur Leinwand",
      "go-board": "Zum Board",
      "go-runs": "Zu den Läufen",
      "go-skills": "Zu den Fähigkeiten",
      settings: "Einstellungen",
      "switch-theme": "Design wechseln",
      "shortcut-sheet": "Tastenkürzel",
      "focus-next-approval": "Zur nächsten Genehmigung",
      "create-task": "Aufgabe erstellen",
      "create-project": "Projekt erstellen",
      approve: "Genehmigen",
      "set-model": "Modell festlegen",
      restore: "Profil wiederherstellen"
    }
  },
  shortcuts: {
    title: "Ops-Tastenkürzel",
    description: "Strg+J bleibt die Desktop-Seitenleiste. Den Dock schaltest du in der Titelleiste oder Statusleiste um. Kein Kürzel genehmigt ungesehene Inhalte.",
    close: "Schließen",
    actions: {
      goOffice: "Büro",
      goCanvas: "Leinwand",
      goBoard: "Board",
      goRuns: "Läufe",
      goSkills: "Fähigkeiten",
      create: "Fokussiert den Erstellbereich. Erstellt keine Aufgabe.",
      filter: "Leistenfilter",
      sheet: "Tastenkürzel",
      edit: "Fokussiertes Ops-Objekt bearbeiten",
      rail: "Leiste umschalten",
      inspector: "Inspektor umschalten",
      move: "Auswahl verschieben",
      open: "Öffnet die fokussierte Zeile. Genehmigt nicht.",
      closeTab: "Schließt den aktiven, nicht angehefteten Ops-Tab. Nie das Fenster.",
      cycleTabs: "Ops-Dokumenttabs durchlaufen",
      history: "Tab-Verlauf",
      settings: "Ops-Einstellungen",
      search: "Ops in der vorhandenen Palette durchsuchen",
      escape: "Schließt die innerste Ebene, dann den Vollbildmodus"
    }
  },
  inspector: {
    label: "Inspektor",
    close: "Inspektor schließen",
    slots: {
      fleet: "Flotte",
      context: "Kontext",
      task: "Aufgabe",
      node: "Knoten",
      history: "Verlauf",
      events: "Ereignisse",
      row: "Zeile"
    },
    selection: "Auswahl",
    detailUnavailable: value => `In ${value} ist noch nichts ausgewählt. Wähle ein Element, um hier Details zu sehen.`,
    fields: inspectorFields('de'),
    runEventsEmpty: "Laufereignisse bleiben leer, bis ein fokussierter Lauf sie liefert."
  },
  dock: {
    label: "Ops-Dock",
    close: "Dock schließen",
    slots: {
      log: "Protokoll",
      events: "Ereignisse",
      problems: "Probleme"
    },
    noLog: "Keine Protokollzeilen",
    noEvents: "Keine Ereignisse",
    problemsUnavailable: "Probleme nicht verfügbar",
    noProblems: "Keine Probleme"
  },
  tabs: {
    label: "Ops-Tabs",
    labelActive: value => `Ops-Tabs, ${value}`,
    close: value => `${value} schließen`,
    more: value => `Weitere Tabs, ${value} ausgeblendet`,
    pin: value => `${value} anheften`,
    unpin: value => `${value} lösen`,
    noRoute: value => `Keine Desktop-Route für ${value}. Diese Shell erfindet keine.`
  },
  toast: {
    open: "Öffnen",
    undo: "Rückgängig",
    moreNeedsYou: value => `+${value} weitere → Braucht dich`,
    kinds: {
      move: "Verschieben",
      archive: "Archivieren",
      reassign: "Neu zuweisen",
      approval: "Genehmigung",
      blocked: "blockiert",
      stop: "Stopp"
    },
    dismiss: value => `${value} schließen`
  },
  table: {
    caption: "Tabelle",
    empty: "Keine Zeilen",
    sortBy: value => `Nach ${value} sortieren`
  },
  node: {
    edit: "Bearbeiten",
    port: value => `Port ${value}`
  },
  motion: {
    rowDescription: "Zustände ändern sich weiterhin und bleiben lesbar"
  },
  why: {
    prefix: "warum · wofür:",
    observed: value => `beobachtet ${value}`,
    missingReason: "Grund nicht erfasst"
  }
}

const opsStatesDe: OpsStatesCopy = {
  empty: {
    title: "Noch nichts hier",
    explanation: "Die Quelle hat geantwortet und hat keine Einträge für diese Ansicht.",
    action: "Aktualisieren"
  },
  loading: {
    title: "Wird geladen",
    explanation: "Diese Ansicht wird aus ihrer eigenen Quelle geladen. Andere Ansichten funktionieren weiter.",
    action: "Jetzt erneut versuchen"
  },
  reconnecting: {
    title: "Verbindung wird wiederhergestellt",
    explanation: "Die Quelle antwortet nicht mehr. Automatischer neuer Versuch; der letzte Stand bleibt sichtbar.",
    action: "Jetzt verbinden"
  },
  stale: {
    title: "Letzter Stand wird angezeigt",
    explanation: "Diese Daten sind älter als ihr Frischebudget. Sie bleiben lesbar, bis eine Aktualisierung gelingt.",
    action: "Aktualisieren"
  },
  exhausted: {
    title: "Wiederholungen gestoppt",
    explanation: "Automatische Wiederholungen haben ihr Limit erreicht. Nichts wird erneut versucht, bis du es anforderst.",
    action: "Erneut versuchen"
  },
  auth: {
    title: "Authentifizierung fehlgeschlagen",
    explanation: "Die Quelle hat die Anmeldedaten abgelehnt (401/403). Erneute Versuche helfen erst nach erneuter Anmeldung.",
    action: "Erneut anmelden"
  },
  capability: {
    title: "Auf dieser Verbindung nicht verfügbar",
    explanation: "Dieses Backend stellt die benötigte Fähigkeit nicht bereit. Das ist kein vorübergehender Fehler.",
    action: "Voraussetzungen anzeigen"
  },
  crashed: {
    title: "Diese Ansicht konnte nicht dargestellt werden",
    explanation: "Nur diese Ansicht wurde angehalten. Der Rest der Seite funktioniert weiter.",
    action: "Ansicht neu laden"
  },
  source: value => `Quelle: ${value}`,
  sourceUnknown: "Quelle: nicht erfasst",
  updated: value => `Aktualisiert ${value}`,
  neverUpdated: "Nie aktualisiert",
  attempt: (a, b) => `Versuch ${a} von ${b}`,
  capabilityName: value => `Benötigt: ${value}`,
  writesDisabled: "Änderungen sind deaktiviert, bis diese Ansicht aktuell ist."
}

const opsEs: OpsCopy = {
  brand: "Ops",
  unavailable: "no disponible",
  unknown: "desconocido",
  readOnly: "solo lectura",
  presence: {
    working: "trabajando",
    needs_you: "te necesita",
    blocked: "bloqueado",
    idle: "inactivo",
    offline: "sin conexión",
    unknown: "desconocido",
    done: "hecho",
    stale: "obsoleto"
  },
  shapes: {
    disc: "disco relleno",
    "reduced-disc": "disco relleno con trazo ajustado",
    ringed: "disco con anillo",
    triangle: "triángulo",
    dot: "punto medio",
    hollow: "disco hueco",
    dotted: "círculo punteado",
    barred: "círculo tachado",
    "static-disc": "disco estático"
  },
  nav: {
    runs: "Ejecuciones",
    review: "Revisión",
    templates: "Plantillas",
    projects: "Proyectos",
    files: "Archivos",
    conversations: "Conversaciones",
    skills: "Habilidades",
    channels: "Canales y MCP",
    activity: "Actividad",
    triggers: "Disparadores",
    schedule: "Programación",
    memory: "Memoria",
    profiles: "Perfiles",
    agents: "Agentes",
    office: "Oficina",
    canvas: "Lienzo",
    board: "Tablero"
  },
  rail: {
    label: "Ops",
    switcher: "Conexión y perfil",
    connection: "Conexión",
    profile: "Perfil",
    showFilter: "Mostrar filtro",
    filter: "Filtrar flota y vistas",
    filterPlaceholder: "Filtrar",
    clearFilter: "Borrar filtro",
    palette: "Paleta",
    sectionOps: "OPS",
    pinned: "Fijados",
    noPins: "Sin fijados",
    lenses: "VISTAS",
    pin: "Fijar",
    unpin: "Desfijar",
    pinItem: value => `Fijar ${value}`,
    unpinItem: value => `Desfijar ${value}`,
    more: "Más",
    needsYou: "Te necesita",
    connect: "+ Conectar",
    settings: "Ajustes",
    fleet: "FLOTA",
    idleCount: value => (value === 1 ? '1 inactivo' : `${value} inactivos`),
    online: value => `${value} en línea`
  },
  chrome: {
    breadcrumb: "Ruta de navegación de Ops",
    searchOps: "Buscar en Ops",
    toggleRail: "Alternar barra lateral",
    toggleDock: "Alternar panel inferior",
    toggleInspector: "Alternar inspector",
    focusedRun: value => `ejecución #${value}`,
    working: value => `${value} trabajando`,
    needsYou: value => `${value} te necesitan`,
    tokens: value => `${value} tok`,
    workingSource: "Observación reciente de la flota A1",
    needsYouSource: "Observación reciente de la flota A1/A3",
    gatewaySource: "/api/status estado de la pasarela + versión del backend · propietario fijado",
    dock: "Panel inferior",
    dockOpen: "Panel inferior abierto",
    problems: value => `Problemas ${value}`
  },
  toolbar: {
    back: "← Chats",
    rail: "Barra lateral",
    inspector: "Inspector",
    dock: "Panel inferior",
    copyLink: "Copiar enlace",
    restoreSplit: "Restaurar división",
    fullScreen: "Ops a pantalla completa",
    openChat: "Abrir el chat existente"
  },
  reasons: {
    modelEdit: "Edición no disponible hasta A5/A6",
    mutation: "No disponible hasta que existan escrituras A5/A6",
    approve: "Ningún atajo aprueba. «Ir a la siguiente aprobación» solo mueve el foco."
  },
  palette: {
    recent: "Búsquedas recientes",
    group: "Ops",
    commands: {
      "go-office": "Ir a Oficina",
      "go-canvas": "Ir a Lienzo",
      "go-board": "Ir a Tablero",
      "go-runs": "Ir a Ejecuciones",
      "go-skills": "Ir a Habilidades",
      settings: "Ajustes",
      "switch-theme": "Cambiar tema",
      "shortcut-sheet": "Lista de atajos",
      "focus-next-approval": "Ir a la siguiente aprobación",
      "create-task": "Crear tarea",
      "create-project": "Crear proyecto",
      approve: "Aprobar",
      "set-model": "Establecer modelo",
      restore: "Restaurar perfil"
    }
  },
  shortcuts: {
    title: "Atajos de Ops",
    description: "Ctrl+J sigue siendo la barra lateral de Desktop. Alterna el panel inferior desde la barra de título o de estado. Ningún atajo aprueba contenido no visto.",
    close: "Cerrar",
    actions: {
      goOffice: "Oficina",
      goCanvas: "Lienzo",
      goBoard: "Tablero",
      goRuns: "Ejecuciones",
      goSkills: "Habilidades",
      create: "Enfoca el área de creación. No crea una tarea.",
      filter: "Filtro de la barra lateral",
      sheet: "Lista de atajos",
      edit: "Editar el objeto de Ops enfocado",
      rail: "Alternar barra lateral",
      inspector: "Alternar inspector",
      move: "Mover la selección",
      open: "Abre la fila enfocada. No aprueba.",
      closeTab: "Cierra la pestaña activa de Ops no fijada. Nunca la ventana.",
      cycleTabs: "Recorrer las pestañas de documentos de Ops",
      history: "Historial de pestañas",
      settings: "Ajustes de Ops",
      search: "Buscar en Ops desde la paleta existente",
      escape: "Cierra la capa más interna y luego la pantalla completa"
    }
  },
  inspector: {
    label: "Inspector",
    close: "Cerrar inspector",
    slots: {
      fleet: "Flota",
      context: "Contexto",
      task: "Tarea",
      node: "Nodo",
      history: "Historial",
      events: "Eventos",
      row: "Fila"
    },
    selection: "Selección",
    detailUnavailable: value => `Todavía no hay nada seleccionado en ${value}. Elegí un elemento para ver su detalle acá.`,
    fields: inspectorFields('es'),
    runEventsEmpty: "Los eventos de ejecución siguen vacíos hasta que una ejecución enfocada los proporcione."
  },
  dock: {
    label: "Panel inferior de Ops",
    close: "Cerrar panel inferior",
    slots: {
      log: "Registro",
      events: "Eventos",
      problems: "Problemas"
    },
    noLog: "Sin líneas de registro",
    noEvents: "Sin eventos",
    problemsUnavailable: "Problemas no disponibles",
    noProblems: "Sin problemas"
  },
  tabs: {
    label: "Pestañas de Ops",
    labelActive: value => `Pestañas de Ops, ${value}`,
    close: value => `Cerrar ${value}`,
    more: value => `Más pestañas, ${value} ocultas`,
    pin: value => `Fijar ${value}`,
    unpin: value => `Desfijar ${value}`,
    noRoute: value => `No hay ruta de Desktop para ${value}. Este shell no inventa una.`
  },
  toast: {
    open: "Abrir",
    undo: "Deshacer",
    moreNeedsYou: value => `+${value} más → Te necesita`,
    kinds: {
      move: "mover",
      archive: "archivar",
      reassign: "reasignar",
      approval: "aprobación",
      blocked: "bloqueado",
      stop: "detener"
    },
    dismiss: value => `Descartar ${value}`
  },
  table: {
    caption: "Tabla",
    empty: "Sin filas",
    sortBy: value => `Ordenar por ${value}`
  },
  node: {
    edit: "Editar",
    port: value => `puerto ${value}`
  },
  motion: {
    rowDescription: "Los estados siguen cambiando y siguen siendo legibles"
  },
  why: {
    prefix: "por qué · para qué:",
    observed: value => `observado ${value}`,
    missingReason: "motivo no registrado"
  }
}

const opsStatesEs: OpsStatesCopy = {
  empty: {
    title: "Aún no hay nada",
    explanation: "La fuente respondió y no tiene elementos para esta vista.",
    action: "Actualizar"
  },
  loading: {
    title: "Cargando",
    explanation: "Obteniendo esta vista desde su propia fuente. Las demás vistas siguen funcionando.",
    action: "Reintentar ahora"
  },
  reconnecting: {
    title: "Reconectando",
    explanation: "La fuente dejó de responder. Reintentando automáticamente; la última instantánea sigue visible.",
    action: "Reconectar ahora"
  },
  stale: {
    title: "Mostrando la última instantánea",
    explanation: "Estos datos superan su plazo de frescura. Se mantienen legibles hasta que una actualización tenga éxito.",
    action: "Actualizar"
  },
  exhausted: {
    title: "Reintentos detenidos",
    explanation: "Los reintentos automáticos alcanzaron su límite. No se reintentará nada hasta que lo pidas.",
    action: "Intentar de nuevo"
  },
  auth: {
    title: "Error de autenticación",
    explanation: "La fuente rechazó las credenciales (401/403). Reintentar no servirá hasta que vuelvas a iniciar sesión.",
    action: "Volver a iniciar sesión"
  },
  capability: {
    title: "No disponible en esta conexión",
    explanation: "Este backend no expone la capacidad que necesita esta vista. No es un fallo temporal.",
    action: "Ver requisitos"
  },
  crashed: {
    title: "Esta vista no se pudo mostrar",
    explanation: "Solo se detuvo esta vista. El resto de la página sigue funcionando.",
    action: "Recargar vista"
  },
  source: value => `Fuente: ${value}`,
  sourceUnknown: "Fuente: no registrada",
  updated: value => `Actualizado ${value}`,
  neverUpdated: "Nunca actualizado",
  attempt: (a, b) => `Intento ${a} de ${b}`,
  capabilityName: value => `Requiere: ${value}`,
  writesDisabled: "Los cambios están desactivados hasta que esta vista esté al día."
}

/** Ops shell copy per bundled locale. Typed as complete: a missing key fails typecheck. */
export const OPS_LOCALES: Record<OpsLocaleId, OpsCopy> = {
  en: opsEn,
  zh: opsZh,
  "zh-hant": opsZhHant,
  ja: opsJa,
  ar: opsAr,
  ru: opsRu,
  fr: opsFr,
  de: opsDe,
  es: opsEs
}

/** W10 state copy per bundled locale. */
export const OPS_STATES_LOCALES: Record<OpsLocaleId, OpsStatesCopy> = {
  en: opsStatesEn,
  zh: opsStatesZh,
  "zh-hant": opsStatesZhHant,
  ja: opsStatesJa,
  ar: opsStatesAr,
  ru: opsStatesRu,
  fr: opsStatesFr,
  de: opsStatesDe,
  es: opsStatesEs
}

/** Locale-overlay entry: spread into each bundled locale so `t.ops`/`t.opsStates` follow the selected language. */
export const opsLocaleEntry = (locale: OpsLocaleId) => ({ ops: OPS_LOCALES[locale], opsStates: OPS_STATES_LOCALES[locale] })

/** Display label for a store-owned nav/lens/view id; non-catalog ids (runs, profiles) keep their own label. */
export function opsNavLabel(copy: OpsCopy, id: string, fallback: string): string {
  const key = id.startsWith('lens:') ? id.slice(5) : id

  return Object.hasOwn(copy.nav, key) ? copy.nav[key as keyof OpsCopy['nav']] : T(fallback)
}

/** Presence/group label for a raw state id (`needs-you` and `needs_you` both resolve). */
export function opsPresenceLabel(copy: OpsCopy, state: string): string {
  const key = state === 'needs-you' ? 'needs_you' : state

  return Object.hasOwn(copy.presence, key) ? copy.presence[key as keyof OpsCopy['presence']] : state
}
