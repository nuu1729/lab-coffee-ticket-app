import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: text("displayName"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isTestAccount: tinyint("isTestAccount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const coffeeBeans = mysqlTable("coffeeBeans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  features: text("features"),
  priceYen: int("priceYen").notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ticketWallets = mysqlTable("ticketWallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  balance: int("balance").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseRequests = mysqlTable("purchaseRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  planCode: mysqlEnum("planCode", ["ten", "twentyFive"]).notNull(),
  ticketCount: int("ticketCount").notNull(),
  priceYen: int("priceYen").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["paypay", "cash"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  note: text("note"),
  isTestRequest: tinyint("isTestRequest").default(0).notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedByUserId: int("approvedByUserId").references(() => users.id),
});

export const ticketTransactions = mysqlTable("ticketTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  delta: int("delta").notNull(),
  type: mysqlEnum("type", ["purchaseGrant", "consume", "adminAdjust"]).notNull(),
  sourceType: mysqlEnum("sourceType", ["purchaseRequest", "qrUse", "adminAction"]).notNull(),
  purchaseRequestId: int("purchaseRequestId").references(() => purchaseRequests.id),
  performedByUserId: int("performedByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const qrCodes = mysqlTable("qrCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  accessUrl: text("accessUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdByUserId: int("createdByUserId")
    .notNull()
    .references(() => users.id),
  isActive: tinyint("isActive").default(1).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type CoffeeBean = typeof coffeeBeans.$inferSelect;
export type InsertCoffeeBean = typeof coffeeBeans.$inferInsert;

export type TicketWallet = typeof ticketWallets.$inferSelect;
export type InsertTicketWallet = typeof ticketWallets.$inferInsert;

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;

export type TicketTransaction = typeof ticketTransactions.$inferSelect;
export type InsertTicketTransaction = typeof ticketTransactions.$inferInsert;

export type QrCode = typeof qrCodes.$inferSelect;
export type InsertQrCode = typeof qrCodes.$inferInsert;
