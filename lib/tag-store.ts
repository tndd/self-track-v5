import { defaultCatalog, mergeCatalog, type Catalog } from './tags.ts';
export async function readCatalog(db: D1Database, user: string) {
    const row = await db.prepare('SELECT data,revision FROM tag_catalogs WHERE user_id=?').bind(user).first<{ data: string; revision: number }>();
    const counts = await db.prepare('SELECT value AS name,COUNT(DISTINCT entries.id) AS count FROM entries,json_each(entries.tags) WHERE user_id=? GROUP BY value').bind(user).all<{ name: string; count: number }>();
    const catalog: Catalog = row ? { ...JSON.parse(row.data), revision: row.revision } : defaultCatalog();
    return { catalog: mergeCatalog(catalog, counts.results.map(r => r.name)), usage: Object.fromEntries(counts.results.map(r => [r.name, r.count])) };
}
export async function writeCatalog(db: D1Database, user: string, catalog: Catalog) {
    const data = JSON.stringify({ groups: catalog.groups, tags: catalog.tags });
    const result = catalog.revision === 0
        ? await db.prepare('INSERT INTO tag_catalogs (user_id,data,revision) VALUES (?,?,1) ON CONFLICT(user_id) DO NOTHING').bind(user, data).run()
        : await db.prepare('UPDATE tag_catalogs SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(data, user, catalog.revision).run();
    return result.meta.changes ? readCatalog(db, user) : null;
}
