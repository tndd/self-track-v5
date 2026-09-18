'use client';
import { Frown, Meh, Smile, SmilePlus, Plus } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MOODS, todayKey } from '@/lib/journal';
export const time = (s: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
export const dateText = (s: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(s + 'T12:00:00+09:00'));
export const localInput = (s: string) => `${todayKey(new Date(s))}T${time(s)}`;
export const fmt = (n: number | null | undefined) => n == null ? '—' : n.toFixed(1);
export const makeId = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = Array.from(b, v => v.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
export async function request<T>(url: string, init?: RequestInit) { const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store', signal: AbortSignal.timeout(20000) }); const body = await r.json() as T & {
    error?: string;
}; if (!r.ok)
    throw new Error(body.error || '接続できませんでした'); return body; }
const icons = [Frown, Frown, Meh, Smile, SmilePlus];
export function MoodButtons({ onPick, selected, disabled = false, label = 'その時の体調' }: {
    onPick: (n: number) => void;
    selected: number | null;
    disabled?: boolean;
    label?: string;
}) { return <div className="moods" role="group" aria-label={label}>{MOODS.map((m, i) => { const Icon = icons[i]; return <button type="button" key={m.score} className={`mood mood-${m.score} ${selected === m.score ? 'chosen' : ''}`} disabled={disabled} onClick={() => onPick(m.score)} aria-pressed={selected === m.score} aria-label={`${label}${m.score} ${m.label}`}><Icon size={30} strokeWidth={1.5}/><span className="mood-word">{m.label}</span><span className="mood-num">{m.score}</span></button>; })}</div>; }
export function TagPicker({ all, value, onChange, onAdd }: {
    all: string[];
    value: string[];
    onChange: (v: string[]) => void;
    onAdd: () => void;
}) { return <div className="tag-wrap"><ToggleGroup type="multiple" value={value} onValueChange={onChange} className="tag-group" spacing={1} aria-label="記録のタグ">{all.map(t => <ToggleGroupItem value={t} key={t} className="tag-chip">#{t}</ToggleGroupItem>)}</ToggleGroup><button type="button" className="tag-add" onClick={onAdd} aria-label="新しいタグを追加"><Plus size={18}/></button></div>; }
