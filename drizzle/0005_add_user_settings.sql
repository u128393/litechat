CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`custom_instructions` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
