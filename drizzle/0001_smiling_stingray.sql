CREATE TABLE `business_favorites` (
	`owner` text NOT NULL,
	`business_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `business_id`)
);
