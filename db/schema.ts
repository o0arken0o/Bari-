import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const missions=sqliteTable('missions',{
 id:text('id').primaryKey(), owner:text('owner').notNull(), businessId:text('business_id').notNull(),
 businessName:text('business_name').notNull(), status:text('status').notNull(), report:text('report').notNull(), createdAt:text('created_at').notNull()
});
