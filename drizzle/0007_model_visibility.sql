DROP INDEX `model_configs_enabled_sort_order_idx`;--> statement-breakpoint
ALTER TABLE `model_configs` ADD `visible` integer NOT NULL DEFAULT 1;--> statement-breakpoint
UPDATE `model_configs` SET `visible` = `enabled`;--> statement-breakpoint
ALTER TABLE `model_configs` DROP COLUMN `enabled`;--> statement-breakpoint
CREATE INDEX `model_configs_visible_sort_order_idx` ON `model_configs` (`visible`,`sort_order`);
