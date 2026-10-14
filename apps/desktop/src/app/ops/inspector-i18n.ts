/**
 * B11: inspector field labels, values and footers in every supported Ops locale.
 * Builders keep emitting English keys; the inspector view localizes at render time,
 * so detail builders stay pure and testable. Unknown strings (job names, column names,
 * profile ids) pass through unchanged.
 */

export const INSPECTOR_KEYS = [
  'Assignee', 'Priority', 'Project', 'Tenant', 'Progress', 'Parents / children', 'Comments', 'Failures in a row', 'Skills',
  'Created', 'Started', 'Last heartbeat', 'Completed', 'Model', 'Prompt', 'Policy', 'Scheduled jobs', 'Time zone', 'Motion',
  'Default model', 'Approvals', 'Secrets set', 'Legacy write routes', 'Provider', 'Exists', 'Lines', 'Words', 'Last change',
  'Name', 'Description', 'Inherits model', 'Source', 'Installed', 'State',
  'Board', 'Settings', 'Identity', 'Tools', 'Delegation', 'Schedule', 'Channels', 'Memory',
  'Unassigned', 'unknown', 'loading', 'not set', 'present', 'missing', 'yes', 'no', 'unset', 'no note', 'built-in', 'paused',
  'ok', 'active (retire flag off)', 'profile', 'violation',
  'Select a card to inspect it.', 'No cards in this scope yet.', 'Select a node to inspect it.',
  'No saved changes recorded for this profile yet.', 'Kanban board', 'Profile canvas', 'Ops settings',
  'the card open in Board', 'column totals for the current scope', 'the profile shown in Canvas', 'the node selected in Canvas',
  "this profile's Ops settings",
  '{a} of {b}', '{n} cards', '{n} failing', '{n} bytes', ' (invalid, writes blocked)',
  'Not observable from here: their approvals live in another process.',
  'Not observable from here'
] as const

export const UNKNOWN_HINT_KEY = INSPECTOR_KEYS[INSPECTOR_KEYS.length - 2]
export const UNKNOWN_SHORT_KEY = INSPECTOR_KEYS[INSPECTOR_KEYS.length - 1]

const T: Record<string, readonly string[]> = {
  es: [
    'Asignado', 'Prioridad', 'Proyecto', 'Tenant', 'Progreso', 'Padres / hijos', 'Comentarios', 'Fallos seguidos', 'Skills',
    'Creada', 'Iniciada', 'Último latido', 'Completada', 'Modelo', 'Prompt', 'Política', 'Tareas programadas', 'Zona horaria', 'Movimiento',
    'Modelo por defecto', 'Aprobaciones', 'Secretos configurados', 'Rutas de escritura legadas', 'Proveedor', 'Existe', 'Líneas', 'Palabras', 'Último cambio',
    'Nombre', 'Descripción', 'Hereda el modelo', 'Origen', 'Instaladas', 'Estado',
    'Tablero', 'Ajustes', 'Identidad', 'Herramientas', 'Delegación', 'Agenda', 'Canales', 'Memoria',
    'Sin asignar', 'desconocido', 'cargando', 'sin definir', 'presente', 'falta', 'sí', 'no', 'sin definir', 'sin nota', 'integrado', 'en pausa',
    'ok', 'activas (flag de retiro apagado)', 'perfil', 'infracción',
    'Elegí una tarjeta para inspeccionarla.', 'Todavía no hay tarjetas en este alcance.', 'Elegí un nodo para inspeccionarlo.',
    'Todavía no hay cambios guardados para este perfil.', 'Tablero kanban', 'Lienzo del perfil', 'Ajustes de Ops',
    'la tarjeta abierta en Tablero', 'totales por columna del alcance actual', 'el perfil que muestra el Lienzo', 'el nodo elegido en el Lienzo',
    'los ajustes de Ops de este perfil',
    '{a} de {b}', '{n} tarjetas', '{n} con fallos', '{n} bytes', ' (inválida, escrituras bloqueadas)',
    'No se puede observar desde acá: sus aprobaciones viven en otro proceso.',
    'No observable desde acá'
  ],
  fr: [
    'Assignée à', 'Priorité', 'Projet', 'Locataire', 'Progression', 'Parents / enfants', 'Commentaires', 'Échecs consécutifs', 'Compétences',
    'Créée', 'Démarrée', 'Dernier signal', 'Terminée', 'Modèle', 'Prompt', 'Politique', 'Tâches planifiées', 'Fuseau horaire', 'Animations',
    'Modèle par défaut', 'Approbations', 'Secrets définis', 'Routes d’écriture héritées', 'Fournisseur', 'Existe', 'Lignes', 'Mots', 'Dernier changement',
    'Nom', 'Description', 'Hérite du modèle', 'Source', 'Installées', 'État',
    'Tableau', 'Réglages', 'Identité', 'Outils', 'Délégation', 'Planification', 'Canaux', 'Mémoire',
    'Non assignée', 'inconnu', 'chargement', 'non défini', 'présent', 'absent', 'oui', 'non', 'non défini', 'sans note', 'intégré', 'en pause',
    'ok', 'actives (retrait désactivé)', 'profil', 'violation',
    'Sélectionnez une carte pour l’inspecter.', 'Aucune carte dans ce périmètre pour l’instant.', 'Sélectionnez un nœud pour l’inspecter.',
    'Aucune modification enregistrée pour ce profil.', 'Tableau kanban', 'Canevas du profil', 'Réglages Ops',
    'la carte ouverte dans Tableau', 'totaux par colonne du périmètre actuel', 'le profil affiché dans Canevas', 'le nœud sélectionné dans Canevas',
    'les réglages Ops de ce profil',
    '{a} sur {b}', '{n} cartes', '{n} en échec', '{n} octets', ' (invalide, écritures bloquées)',
    'Non observable d’ici : leurs approbations vivent dans un autre processus.',
    'Non observable d’ici'
  ],
  de: [
    'Zugewiesen an', 'Priorität', 'Projekt', 'Mandant', 'Fortschritt', 'Eltern / Kinder', 'Kommentare', 'Fehlschläge in Folge', 'Skills',
    'Erstellt', 'Gestartet', 'Letzter Heartbeat', 'Abgeschlossen', 'Modell', 'Prompt', 'Richtlinie', 'Geplante Jobs', 'Zeitzone', 'Bewegung',
    'Standardmodell', 'Freigaben', 'Gesetzte Secrets', 'Alte Schreibrouten', 'Anbieter', 'Vorhanden', 'Zeilen', 'Wörter', 'Letzte Änderung',
    'Name', 'Beschreibung', 'Erbt Modell', 'Quelle', 'Installiert', 'Status',
    'Board', 'Einstellungen', 'Identität', 'Werkzeuge', 'Delegation', 'Zeitplan', 'Kanäle', 'Speicher',
    'Nicht zugewiesen', 'unbekannt', 'lädt', 'nicht gesetzt', 'vorhanden', 'fehlt', 'ja', 'nein', 'nicht gesetzt', 'keine Notiz', 'integriert', 'pausiert',
    'ok', 'aktiv (Abschalt-Flag aus)', 'Profil', 'Verstoß',
    'Wähle eine Karte aus, um sie zu prüfen.', 'Noch keine Karten in diesem Bereich.', 'Wähle einen Knoten aus, um ihn zu prüfen.',
    'Für dieses Profil sind noch keine gespeicherten Änderungen erfasst.', 'Kanban-Board', 'Profil-Leinwand', 'Ops-Einstellungen',
    'die in Board geöffnete Karte', 'Spaltensummen für den aktuellen Bereich', 'das in Leinwand gezeigte Profil', 'der in Leinwand gewählte Knoten',
    'die Ops-Einstellungen dieses Profils',
    '{a} von {b}', '{n} Karten', '{n} fehlerhaft', '{n} Bytes', ' (ungültig, Schreiben blockiert)',
    'Von hier nicht beobachtbar: ihre Freigaben liegen in einem anderen Prozess.',
    'Von hier nicht beobachtbar'
  ],
  ru: [
    'Исполнитель', 'Приоритет', 'Проект', 'Арендатор', 'Прогресс', 'Родители / дети', 'Комментарии', 'Сбоев подряд', 'Навыки',
    'Создана', 'Начата', 'Последний сигнал', 'Завершена', 'Модель', 'Промпт', 'Политика', 'Задания по расписанию', 'Часовой пояс', 'Анимация',
    'Модель по умолчанию', 'Подтверждения', 'Заданные секреты', 'Устаревшие маршруты записи', 'Провайдер', 'Существует', 'Строки', 'Слова', 'Последнее изменение',
    'Имя', 'Описание', 'Наследует модель', 'Источник', 'Установлено', 'Состояние',
    'Доска', 'Настройки', 'Идентичность', 'Инструменты', 'Делегирование', 'Расписание', 'Каналы', 'Память',
    'Не назначено', 'неизвестно', 'загрузка', 'не задано', 'есть', 'отсутствует', 'да', 'нет', 'не задано', 'без заметки', 'встроенная', 'на паузе',
    'ок', 'активны (флаг отключения выкл.)', 'профиль', 'нарушение',
    'Выберите карточку, чтобы посмотреть её.', 'В этой области пока нет карточек.', 'Выберите узел, чтобы посмотреть его.',
    'Для этого профиля пока нет сохранённых изменений.', 'Kanban-доска', 'Холст профиля', 'Настройки Ops',
    'карточка, открытая на Доске', 'итоги по колонкам для текущей области', 'профиль, показанный на Холсте', 'узел, выбранный на Холсте',
    'настройки Ops этого профиля',
    '{a} из {b}', 'карточек: {n}', 'со сбоями: {n}', '{n} байт', ' (недействительна, запись заблокирована)',
    'Отсюда не наблюдается: их подтверждения находятся в другом процессе.',
    'Отсюда не наблюдается'
  ],
  ja: [
    '担当者', '優先度', 'プロジェクト', 'テナント', '進捗', '親 / 子', 'コメント', '連続失敗', 'スキル',
    '作成', '開始', '最終ハートビート', '完了', 'モデル', 'プロンプト', 'ポリシー', 'スケジュール済みジョブ', 'タイムゾーン', 'モーション',
    '既定のモデル', '承認', '設定済みシークレット', 'レガシー書き込みルート', 'プロバイダー', '存在', '行数', '単語数', '最終変更',
    '名前', '説明', 'モデルを継承', 'ソース', 'インストール済み', '状態',
    'ボード', '設定', 'アイデンティティ', 'ツール', '委任', 'スケジュール', 'チャネル', 'メモリ',
    '未割り当て', '不明', '読み込み中', '未設定', 'あり', 'なし', 'はい', 'いいえ', '未設定', 'メモなし', '組み込み', '一時停止',
    '正常', '有効（廃止フラグはオフ）', 'プロフィール', '違反',
    'カードを選択すると詳細を表示します。', 'この範囲にはまだカードがありません。', 'ノードを選択すると詳細を表示します。',
    'このプロフィールの保存済み変更はまだありません。', 'かんばんボード', 'プロフィールキャンバス', 'Ops 設定',
    'ボードで開いているカード', '現在の範囲の列ごとの合計', 'キャンバスに表示中のプロフィール', 'キャンバスで選択中のノード',
    'このプロフィールの Ops 設定',
    '{a} / {b}', '{n} 枚', '{n} 件失敗', '{n} バイト', '（無効、書き込みはブロック）',
    'ここからは観測できません。承認は別のプロセスにあります。',
    'ここからは観測不可'
  ],
  zh: [
    '负责人', '优先级', '项目', '租户', '进度', '父 / 子', '评论', '连续失败', '技能',
    '创建于', '开始于', '最后心跳', '完成于', '模型', '提示词', '策略', '计划任务', '时区', '动效',
    '默认模型', '审批', '已设置的密钥', '旧版写入路由', '提供商', '存在', '行数', '字数', '最后修改',
    '名称', '描述', '继承模型', '来源', '已安装', '状态',
    '看板', '设置', '身份', '工具', '委派', '计划', '频道', '记忆',
    '未分配', '未知', '加载中', '未设置', '有', '缺失', '是', '否', '未设置', '无备注', '内置', '已暂停',
    '正常', '启用（停用开关关闭）', '配置文件', '违规',
    '选择一张卡片以查看详情。', '此范围内还没有卡片。', '选择一个节点以查看详情。',
    '此配置文件尚无已保存的更改记录。', 'Kanban 看板', '配置文件画布', 'Ops 设置',
    '看板中打开的卡片', '当前范围的各列合计', '画布中显示的配置文件', '画布中选中的节点',
    '此配置文件的 Ops 设置',
    '{a} / {b}', '{n} 张卡片', '{n} 个失败', '{n} 字节', '（无效，写入已阻止）',
    '无法从此处观测：其审批位于另一个进程中。',
    '无法从此处观测'
  ],
  'zh-hant': [
    '負責人', '優先順序', '專案', '租戶', '進度', '父 / 子', '留言', '連續失敗', '技能',
    '建立於', '開始於', '最後心跳', '完成於', '模型', '提示詞', '政策', '排程工作', '時區', '動態效果',
    '預設模型', '核准', '已設定的密鑰', '舊版寫入路由', '供應商', '存在', '行數', '字數', '最後變更',
    '名稱', '描述', '繼承模型', '來源', '已安裝', '狀態',
    '看板', '設定', '身分', '工具', '委派', '排程', '頻道', '記憶',
    '未指派', '未知', '載入中', '未設定', '有', '缺少', '是', '否', '未設定', '無備註', '內建', '已暫停',
    '正常', '啟用（停用旗標關閉）', '設定檔', '違規',
    '選取一張卡片以檢視詳細資料。', '此範圍內尚無卡片。', '選取一個節點以檢視詳細資料。',
    '此設定檔尚無已儲存的變更紀錄。', 'Kanban 看板', '設定檔畫布', 'Ops 設定',
    '看板中開啟的卡片', '目前範圍的各欄合計', '畫布中顯示的設定檔', '畫布中選取的節點',
    '此設定檔的 Ops 設定',
    '{a} / {b}', '{n} 張卡片', '{n} 個失敗', '{n} 位元組', '（無效，寫入已封鎖）',
    '無法從此處觀測：其核准位於另一個處理程序中。',
    '無法從此處觀測'
  ],
  ar: [
    'المكلَّف', 'الأولوية', 'المشروع', 'المستأجر', 'التقدم', 'الآباء / الأبناء', 'التعليقات', 'إخفاقات متتالية', 'المهارات',
    'أُنشئت', 'بدأت', 'آخر نبضة', 'اكتملت', 'النموذج', 'الموجِّه', 'السياسة', 'المهام المجدولة', 'المنطقة الزمنية', 'الحركة',
    'النموذج الافتراضي', 'الموافقات', 'الأسرار المضبوطة', 'مسارات الكتابة القديمة', 'المزوّد', 'موجود', 'الأسطر', 'الكلمات', 'آخر تغيير',
    'الاسم', 'الوصف', 'يرث النموذج', 'المصدر', 'المثبّتة', 'الحالة',
    'اللوح', 'الإعدادات', 'الهوية', 'الأدوات', 'التفويض', 'الجدولة', 'القنوات', 'الذاكرة',
    'غير مُسنَدة', 'غير معروف', 'جارٍ التحميل', 'غير مضبوط', 'موجود', 'مفقود', 'نعم', 'لا', 'غير مضبوط', 'بلا ملاحظة', 'مدمج', 'متوقف مؤقتًا',
    'سليم', 'نشطة (علم الإيقاف معطّل)', 'ملف التعريف', 'مخالفة',
    'اختر بطاقة لفحصها.', 'لا توجد بطاقات في هذا النطاق بعد.', 'اختر عقدة لفحصها.',
    'لا توجد تغييرات محفوظة لهذا الملف بعد.', 'لوح كانبان', 'لوحة الملف', 'إعدادات Ops',
    'البطاقة المفتوحة في اللوح', 'إجماليات الأعمدة للنطاق الحالي', 'الملف المعروض في اللوحة', 'العقدة المحددة في اللوحة',
    'إعدادات Ops لهذا الملف',
    '{a} من {b}', '{n} بطاقة', '{n} متعثرة', '{n} بايت', ' (غير صالحة، الكتابة محظورة)',
    'غير قابل للرصد من هنا: موافقاتها في عملية أخرى.',
    'غير قابل للرصد من هنا'
  ]
}

/** Per-locale dictionary keyed by the English string; English is the identity map. */
export function inspectorFields(locale: string): Record<string, string> {
  const row = T[locale]
  const out: Record<string, string> = {}
  INSPECTOR_KEYS.forEach((k, i) => {
    out[k] = row?.[i] ?? k
  })

  return out
}

export const INSPECTOR_TRANSLATIONS = T

const TEMPLATES: [RegExp, string][] = [
  [/^(\d+) of (\d+)$/, '{a} of {b}'],
  [/^(\d+) cards$/, '{n} cards'],
  [/^(\d+) failing$/, '{n} failing'],
  [/^(\d+) bytes$/, '{n} bytes']
]

const SUFFIX = ' (invalid, writes blocked)'

/** Localize one inspector string; anything not in the dictionary passes through. */
export function localizeInspector(s: string | null | undefined, dict: Record<string, string>): string {
  if (s == null) {
    return ''
  }

  if (s in dict) {
    return dict[s]
  }

  for (const [re, key] of TEMPLATES) {
    const m = re.exec(s)

    if (m) {
      return (dict[key] ?? key).replace('{a}', m[1]).replace('{n}', m[1]).replace('{b}', m[2] ?? '')
    }
  }

  if (s.endsWith(SUFFIX)) {
    return s.slice(0, -SUFFIX.length) + (dict[SUFFIX] ?? SUFFIX)
  }

  // "provider / model" pairs: localize each side ("unset / unset").
  if (s.includes(' / ')) {
    return s.split(' / ').map(p => dict[p] ?? p).join(' / ')
  }

  return s
}
