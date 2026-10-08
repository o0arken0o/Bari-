CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`business_id` text NOT NULL,
	`business_name` text NOT NULL,
	`status` text NOT NULL,
	`report` text NOT NULL,
	`created_at` text NOT NULL
);
