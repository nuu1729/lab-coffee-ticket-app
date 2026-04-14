ALTER TABLE `ticketTransactions` MODIFY COLUMN `sourceType` enum('purchaseRequest','qrUse','adminAction') NOT NULL;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `isInstantPurchase` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ticketTransactions` DROP COLUMN `purchaseTag`;