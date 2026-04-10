CREATE TABLE `coffeeBeans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`features` text,
	`priceYen` int NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coffeeBeans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` enum('ten','twentyFive') NOT NULL,
	`ticketCount` int NOT NULL,
	`priceYen` int NOT NULL,
	`paymentMethod` enum('paypay','cash') NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`note` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`approvedByUserId` int,
	CONSTRAINT `purchaseRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticketTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`delta` int NOT NULL,
	`type` enum('purchaseGrant','consume','adminAdjust') NOT NULL,
	`sourceType` enum('purchaseRequest','qrUse','adminAction') NOT NULL,
	`purchaseRequestId` int,
	`performedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticketWallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ticketWallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticketWallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD CONSTRAINT `purchaseRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD CONSTRAINT `purchaseRequests_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketTransactions` ADD CONSTRAINT `ticketTransactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketTransactions` ADD CONSTRAINT `ticketTransactions_purchaseRequestId_purchaseRequests_id_fk` FOREIGN KEY (`purchaseRequestId`) REFERENCES `purchaseRequests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketTransactions` ADD CONSTRAINT `ticketTransactions_performedByUserId_users_id_fk` FOREIGN KEY (`performedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketWallets` ADD CONSTRAINT `ticketWallets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;