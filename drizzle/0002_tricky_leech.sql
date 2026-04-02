CREATE TABLE `model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_config_id` text NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`enabled` integer NOT NULL,
	`supports_web_search` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_config_id`) REFERENCES `provider_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_configs_provider_config_id_idx` ON `model_configs` (`provider_config_id`);--> statement-breakpoint
CREATE INDEX `model_configs_enabled_sort_order_idx` ON `model_configs` (`enabled`,`sort_order`);