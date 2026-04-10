CREATE TABLE `qrCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`accessUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `qrCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `qrCodes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `isTestRequest` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `displayName` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isTestAccount` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `qrCodes` ADD CONSTRAINT `qrCodes_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;