import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('entries', {
    id: text('id').notNull(), userId: text('user_id').notNull(), date: text('date').notNull(), recordedAt: text('recorded_at').notNull(), score: integer('score'), pain: integer('pain'), note: text('note').notNull().default(''), tags: text('tags').notNull().default('[]'), updatedAt: text('updated_at').notNull()
}, t => [primaryKey({ columns: [t.userId, t.id] }), index('idx_entries_user_date').on(t.userId, t.date), index('idx_entries_user_time_id').on(t.userId, t.recordedAt, t.id)]);
export const dailySummaries = sqliteTable('daily_summaries', {
    userId: text('user_id').notNull(), date: text('date').notNull(), score: integer('score').notNull(), note: text('note').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, t => [primaryKey({ columns: [t.userId, t.date] })]);
