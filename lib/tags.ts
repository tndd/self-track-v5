import { z } from 'zod';
import { DEFAULT_TAGS } from './journal.ts';
export const UNGROUPED = '未分類';
export const FREQUENT = 'よく使うタグ';
const name = z.string().trim().min(1).max(30);
export const catalogSchema = z.object({
    revision: z.number().int().nonnegative(),
    groups: z.array(name.refine(n => n !== FREQUENT, 'よく使うタグは自動集計用の名前です')).max(50),
    tags: z.array(z.object({ name, group: name, quantified: z.boolean(), unit: z.string().trim().max(10), archived: z.boolean() }).strict()).max(300)
}).strict().refine(c => c.groups.includes(UNGROUPED) && new Set(c.groups).size === c.groups.length, 'グループ名の重複、または未分類の削除はできません').refine(c => new Set(c.tags.map(t => t.name)).size === c.tags.length, '同じ名前のタグは一つまでです').refine(c => c.tags.every(t => c.groups.includes(t.group)), 'タグの所属先を確認してください');
export type Catalog = z.infer<typeof catalogSchema>;
export type TagDefinition = Catalog['tags'][number];
export function defaultCatalog(): Catalog { return { revision: 0, groups: ['生活', '症状', '薬・運動', UNGROUPED], tags: DEFAULT_TAGS.map((name, i) => ({ name, group: i < 5 ? '生活' : i === 5 ? '薬・運動' : '症状', quantified: false, unit: '', archived: false })) }; }
export function mergeCatalog(c: Catalog, names: string[]): Catalog { const known = new Set(c.tags.map(t => t.name)); return { ...c, tags: [...c.tags, ...names.filter(n => !known.has(n)).map(name => ({ name, group: UNGROUPED, quantified: false, unit: '', archived: false }))] }; }
export function frequentTags(c: Catalog, usage: Record<string, number>) { return c.tags.filter(t => !t.archived && (usage[t.name] ?? 0) > 0).sort((a, b) => (usage[b.name] ?? 0) - (usage[a.name] ?? 0) || a.name.localeCompare(b.name, 'ja')).slice(0, 6); }
