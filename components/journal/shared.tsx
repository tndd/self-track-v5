'use client';
import { type Catalog, FREQUENT, frequentTags } from '@/lib/tags';
import { Frown, Annoyed, Meh, Smile, SmilePlus, Plus, Minus, X, Tag, Check, Folder, Clock } from 'lucide-react';
import { MOODS, todayKey } from '@/lib/journal';
export const time = (s: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
export const dateText = (s: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(s + 'T12:00:00+09:00'));
export const localInput = (s: string) => `${todayKey(new Date(s))}T${time(s)}`;
export const fmt = (n: number | null | undefined) => n == null ? '—' : n.toFixed(1);
export const makeId = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = Array.from(b, v => v.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
export async function request<T>(url: string, init?: RequestInit) { const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'; const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(demo ? { 'X-Shizuku-Dataset': 'demo' } : {}), ...init?.headers }, cache: 'no-store', signal: AbortSignal.timeout(20000) }); const body = await r.json() as T & {
    error?: string;
}; if (!r.ok)
    throw new Error(body.error || '接続できませんでした'); return body; }
const icons = [Frown, Annoyed, Meh, Smile, SmilePlus];
export function MoodIcon({ score, size = 28 }: { score: number; size?: number }) { const Icon = icons[score - 1] ?? Meh; return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />; }
export function MoodButtons({ onPick, selected, disabled = false, label = 'その時の体調' }: {
    onPick: (n: number) => void;
    selected: number | null;
    disabled?: boolean;
    label?: string;
}) { return <div className="moods" role="group" aria-label={label}>{MOODS.map(m => <button type="button" key={m.score} className={`mood mood-${m.score} ${selected === m.score ? 'chosen' : ''}`} disabled={disabled} onClick={() => onPick(m.score)} aria-pressed={selected === m.score} aria-label={`${label}${m.score} ${m.label}`} title={`${m.score} · ${m.label}`}><MoodIcon score={m.score}/></button>)}</div>; }

export function TagPicker({ all, value, onChange, onAdd, catalog, usage = {}, recent = [], expanded = true, quantities = {}, onQuantities }: {
    all: string[]; value: string[]; onChange: (v: string[]) => void; onAdd: () => void;
    catalog?: Catalog; usage?: Record<string, number>; recent?: string[]; expanded?: boolean;
    quantities?: Record<string, number>; onQuantities?: (v: Record<string, number>) => void;
}) {
    const active = catalog?.tags.filter(t => !t.archived) ?? [];
    const quick = recent.filter(t => active.some(a => a.name === t)).slice(0, 6);
    const shown = [...new Set([...(quick.length ? quick : active.slice(0, 6).map(t => t.name)), ...value])];
    const frequent = catalog ? frequentTags(catalog, usage).map(t => t.name) : [];
    const chips = (names: string[], label: string) => <div className="tag-catalog-chips" role="group" aria-label={label}>{names.map(t => <button type="button" key={t} className={`catalog-chip ${value.includes(t) ? 'in-cart' : ''}`} aria-label={`${t}を追加`} disabled={value.includes(t) || value.length >= 20} onClick={() => onChange([...value, t])}>{value.includes(t) ? <Check size={14}/> : <Plus size={14}/>}<span>{t}</span></button>)}</div>;
    return <div className="tag-picker">
      <div className="tag-quick-label"><Clock size={13}/>{quick.length ? '最近使ったタグ' : 'タグを選ぶ'}</div>
      <div className="tag-wrap">{chips(catalog ? shown : all, '最近のタグ')}<button type="button" className="tag-add" onClick={onAdd} aria-label="新しいタグを追加"><Plus size={18}/></button></div>
      {expanded && catalog && <div className="tag-folders" aria-label="グループ別のタグ">{[...(frequent.length ? [{name: FREQUENT, tags: frequent}] : []), ...catalog.groups.map(g => ({name: g, tags: active.filter(t => t.group === g).map(t => t.name)}))].map(g => <details className="tag-folder" key={g.name} open><summary><Folder size={18}/><span>{g.name}</span><small>{g.tags.length}</small></summary><div className="tag-wrap">{g.tags.length ? chips(g.tags, `${g.name}のタグ`) : <span className="metadata">タグはまだありません</span>}</div></details>)}</div>}
      {value.length > 0 && <section className="tag-cart" aria-label="今回のタグ"><div className="cart-heading"><span>今回のタグ <b>{value.length}</b></span><small>送信で確定</small></div><ul>{value.map(t => { const quantity = quantities[t] ?? 1; return <li key={t}><Tag size={16}/><span className="cart-tag-name">{t}</span>{onQuantities && <div className="quantity-stepper"><button type="button" aria-label={`${t}を1減らす`} disabled={!Number.isFinite(quantity) || quantity <= 1} onClick={() => onQuantities({...quantities, [t]: Math.max(1, quantity - 1)})}><Minus size={15}/></button><input aria-label={`${t}の数量・強度`} type="number" inputMode="decimal" min="0.01" max="1000000" step="any" value={Number.isNaN(quantity) ? '' : quantity} onChange={e => onQuantities({...quantities, [t]: e.target.valueAsNumber})}/><button type="button" aria-label={`${t}を1増やす`} disabled={!Number.isFinite(quantity) || quantity >= 1000000} onClick={() => onQuantities({...quantities, [t]: Math.min(1000000, quantity + 1)})}><Plus size={15}/></button></div>}<button type="button" className="cart-remove" aria-label={`${t}を外す`} onClick={() => onChange(value.filter(n => n !== t))}><X size={16}/></button></li>; })}</ul><p className="cart-hint">数値は今回だけ。数字をタップすると小数も入力できます。</p></section>}
    </div>;
}

export function RecordedTag({ name, quantity = 1, onClick }: { name: string; quantity?: number; onClick?: () => void }) {
    const content = <><Tag size={13}/><span>{name}</span><b aria-label={`数量・強度 ${quantity}`}>{quantity}</b></>;
    return onClick ? <button type="button" className="recorded-tag" onClick={onClick} aria-label={`${name}、数量・強度${quantity}で絞り込む`}>{content}</button> : <span className="recorded-tag">{content}</span>;
}
