// 配置だけを定義する。下書き・保存・データ取得は全案で共有する。
export const layouts = [
    { id: 'standard', name: '標準', hint: '入力と履歴を一続きに。', composer: 'inline', history: 'all', previous: false },
    { id: 'focus', name: '一枚', hint: 'いま残すことだけに集中。履歴は切り替えて読む。', composer: 'inline', history: 'all', previous: false },
    { id: 'dock', name: '会話', hint: '上で読み、下で書く。入力欄がいつも手元に。', composer: 'dock', history: 'all', previous: false },
    { id: 'daybook', name: '日めくり', hint: '一日が一ページ。記録をたどり、その日に書き足す。', composer: 'sheet', history: 'day', previous: false },
    { id: 'chronicle', name: '時間軸', hint: '一日の流れを時間に沿って読む。', composer: 'sheet', history: 'axis', previous: true },
    { id: 'thumb', name: '片手入力', hint: '広い履歴と、下側の記録ボタン。', composer: 'sheet', history: 'all', previous: true },
] as const;

export type RecordLayout = typeof layouts[number];
export const getLayout = (id: string): RecordLayout => layouts.find(item => item.id === id) ?? layouts[0];
