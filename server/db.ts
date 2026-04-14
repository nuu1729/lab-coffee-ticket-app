import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  coffeeBeans,
  InsertCoffeeBean,
  InsertUser,
  purchaseRequests,
  qrCodes,
  ticketTransactions,
  ticketWallets,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export const TICKET_PLAN_DEFINITIONS = {
  ten: {
    code: "ten",
    label: "10回 / 500円",
    ticketCount: 10,
    priceYen: 500,
  },
  twentyFour: {
    code: "twentyFour",
    label: "24回 / 1000円",
    ticketCount: 24,
    priceYen: 1000,
  },
} as const;

export type TicketPlanCode = keyof typeof TICKET_PLAN_DEFINITIONS;
export type PaymentMethod = "paypay" | "cash";

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function getTicketPlanDefinition(planCode: TicketPlanCode) {
  return TICKET_PLAN_DEFINITIONS[planCode];
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

export async function updateUserDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.update(users).set({ displayName }).where(eq(users.id, userId));

  return getUserById(userId);
}

async function ensureTicketWalletRecord(userId: number, dbClient: any) {
  if (!dbClient) {
    throw new Error("Database is not available");
  }

  const existing = await dbClient
    .select()
    .from(ticketWallets)
    .where(eq(ticketWallets.userId, userId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  await dbClient.insert(ticketWallets).values({ userId, balance: 0 });

  const created = await dbClient
    .select()
    .from(ticketWallets)
    .where(eq(ticketWallets.userId, userId))
    .limit(1);

  return created[0]!;
}

export async function getDashboardData(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const wallet = await ensureTicketWalletRecord(userId, db);
  const activeBeans = await db
    .select()
    .from(coffeeBeans)
    .where(eq(coffeeBeans.isActive, 1))
    .orderBy(desc(coffeeBeans.updatedAt), desc(coffeeBeans.id));

  const recentRequests = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.userId, userId))
    .orderBy(desc(purchaseRequests.requestedAt), desc(purchaseRequests.id))
    .limit(5);

  return {
    wallet,
    activeBean: activeBeans[0] ?? null,
    recentRequests,
    plans: Object.values(TICKET_PLAN_DEFINITIONS),
  };
}

export async function createPurchaseRequest(input: {
  userId: number;
  planCode: TicketPlanCode;
  paymentMethod: PaymentMethod;
  note?: string | null;
  isTestRequest?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const plan = getTicketPlanDefinition(input.planCode);

  return db.transaction(async tx => {
    await tx.insert(purchaseRequests).values({
      userId: input.userId,
      planCode: input.planCode,
      ticketCount: plan.ticketCount,
      priceYen: plan.priceYen,
      paymentMethod: input.paymentMethod,
      note: input.note ?? null,
      status: input.isTestRequest ? "approved" : "pending",
      isTestRequest: input.isTestRequest ? 1 : 0,
      approvedAt: input.isTestRequest ? new Date() : null,
      approvedByUserId: input.isTestRequest ? input.userId : null,
    });

    // テストリクエストの場合は自動的にチケットを付与
    if (input.isTestRequest) {
      const wallet = await ensureTicketWalletRecord(input.userId, tx);
      await tx
        .update(ticketWallets)
        .set({
          balance: wallet.balance + plan.ticketCount,
        })
        .where(eq(ticketWallets.userId, input.userId));

      await tx.insert(ticketTransactions).values({
        userId: input.userId,
        delta: plan.ticketCount,
        type: "purchaseGrant",
        sourceType: "purchaseRequest",
        performedByUserId: input.userId,
      });
    }

    return {
      success: true as const,
      plan,
    };
  });
}

export async function getUserPurchaseRequests(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.userId, userId))
    .orderBy(desc(purchaseRequests.requestedAt), desc(purchaseRequests.id));
}

export async function consumeTicketViaQr(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db.transaction(async tx => {
    const wallet = await ensureTicketWalletRecord(userId, tx);

    if (wallet.balance <= 0) {
      throw new Error("利用可能なチケットがありません");
    }

    await tx
      .update(ticketWallets)
      .set({
        balance: sql`${ticketWallets.balance} - 1`,
      })
      .where(eq(ticketWallets.userId, userId));

    await tx.insert(ticketTransactions).values({
      userId,
      delta: -1,
      type: "consume",
      sourceType: "qrUse",
      performedByUserId: userId,
    });

    const updatedWallet = await tx
      .select()
      .from(ticketWallets)
      .where(eq(ticketWallets.userId, userId))
      .limit(1);

    return {
      success: true as const,
      balance: updatedWallet[0]?.balance ?? 0,
      usedAt: Date.now(),
    };
  });
}

export async function listPendingPurchaseRequests() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db
    .select({
      id: purchaseRequests.id,
      userId: purchaseRequests.userId,
      planCode: purchaseRequests.planCode,
      ticketCount: purchaseRequests.ticketCount,
      priceYen: purchaseRequests.priceYen,
      paymentMethod: purchaseRequests.paymentMethod,
      status: purchaseRequests.status,
      note: purchaseRequests.note,
      requestedAt: purchaseRequests.requestedAt,
      approvedAt: purchaseRequests.approvedAt,
      approvedByUserId: purchaseRequests.approvedByUserId,
      requesterName: users.name,
      requesterEmail: users.email,
      displayName: users.displayName,
    })
    .from(purchaseRequests)
    .innerJoin(users, eq(purchaseRequests.userId, users.id))
    .where(eq(purchaseRequests.status, "pending"))
    .orderBy(desc(purchaseRequests.requestedAt), desc(purchaseRequests.id));
}

export async function approvePurchaseRequest(input: { requestId: number; adminUserId: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db.transaction(async tx => {
    const requestRows = await tx
      .select()
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.id, input.requestId), eq(purchaseRequests.status, "pending")))
      .limit(1);

    const request = requestRows[0];
    if (!request) {
      throw new Error("承認対象の購入申請が見つかりません");
    }

    const wallet = await ensureTicketWalletRecord(request.userId, tx);

    await tx
      .update(purchaseRequests)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedByUserId: input.adminUserId,
      })
      .where(eq(purchaseRequests.id, input.requestId));

    await tx
      .update(ticketWallets)
      .set({
        balance: wallet.balance + request.ticketCount,
      })
      .where(eq(ticketWallets.userId, request.userId));

    await tx.insert(ticketTransactions).values({
      userId: request.userId,
      delta: request.ticketCount,
      type: "purchaseGrant",
      sourceType: "purchaseRequest",
      purchaseRequestId: request.id,
      performedByUserId: input.adminUserId,
    });

    const updatedWallet = await tx
      .select()
      .from(ticketWallets)
      .where(eq(ticketWallets.userId, request.userId))
      .limit(1);

    return {
      success: true as const,
      requestId: request.id,
      grantedTickets: request.ticketCount,
      balance: updatedWallet[0]?.balance ?? wallet.balance + request.ticketCount,
    };
  });
}

export async function listCoffeeBeans() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db.select().from(coffeeBeans).orderBy(desc(coffeeBeans.isActive), desc(coffeeBeans.updatedAt));
}

export async function saveCoffeeBean(input: InsertCoffeeBean) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  if (input.id) {
    await db
      .update(coffeeBeans)
      .set({
        name: input.name,
        features: input.features ?? null,
        priceYen: input.priceYen,
        isActive: input.isActive ?? 1,
      })
      .where(eq(coffeeBeans.id, input.id));

    const updated = await db.select().from(coffeeBeans).where(eq(coffeeBeans.id, input.id)).limit(1);
    return updated[0] ?? null;
  }

  await db.insert(coffeeBeans).values({
    name: input.name,
    features: input.features ?? null,
    priceYen: input.priceYen,
    isActive: input.isActive ?? 1,
  });

  const created = await db
    .select()
    .from(coffeeBeans)
    .orderBy(desc(coffeeBeans.id))
    .limit(1);

  return created[0] ?? null;
}

export async function listUsageLogs(limit = 100) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db
    .select({
      id: ticketTransactions.id,
      userId: ticketTransactions.userId,
      delta: ticketTransactions.delta,
      type: ticketTransactions.type,
      sourceType: ticketTransactions.sourceType,
      createdAt: ticketTransactions.createdAt,
      userName: users.name,
      userEmail: users.email,
      displayName: users.displayName,
    })
    .from(ticketTransactions)
    .innerJoin(users, eq(ticketTransactions.userId, users.id))
    .where(eq(ticketTransactions.type, "consume"))
    .orderBy(desc(ticketTransactions.createdAt), desc(ticketTransactions.id))
    .limit(limit);
}

export async function getUsageStatsSummary() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const [summary] = await db
    .select({
      totalConsumptions: sql<number>`COALESCE(SUM(CASE WHEN ${ticketTransactions.type} = 'consume' THEN 1 ELSE 0 END), 0)`,
      totalGrantedTickets: sql<number>`COALESCE(SUM(CASE WHEN ${ticketTransactions.type} = 'purchaseGrant' THEN ${ticketTransactions.delta} ELSE 0 END), 0)`,
      totalPendingRequests: sql<number>`COALESCE(SUM(CASE WHEN ${purchaseRequests.status} = 'pending' THEN 1 ELSE 0 END), 0)`,
    })
    .from(ticketTransactions)
    .leftJoin(purchaseRequests, eq(ticketTransactions.purchaseRequestId, purchaseRequests.id));

  const activeBeans = await db
    .select({
      id: coffeeBeans.id,
      name: coffeeBeans.name,
      priceYen: coffeeBeans.priceYen,
      updatedAt: coffeeBeans.updatedAt,
    })
    .from(coffeeBeans)
    .where(eq(coffeeBeans.isActive, 1))
    .orderBy(desc(coffeeBeans.updatedAt), desc(coffeeBeans.id))
    .limit(1);

  return {
    totalConsumptions: Number(summary?.totalConsumptions ?? 0),
    totalGrantedTickets: Number(summary?.totalGrantedTickets ?? 0),
    totalPendingRequests: Number(summary?.totalPendingRequests ?? 0),
    activeBean: activeBeans[0] ?? null,
    generatedAt: Date.now(),
  };
}

export async function generateQrCode(adminUserId: number, baseUrl: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const code = nanoid(12);
  const accessUrl = `${baseUrl}/use?qr=${code}`;

  await db.insert(qrCodes).values({
    code,
    accessUrl,
    createdByUserId: adminUserId,
    isActive: 1,
  });

  // Retrieve the inserted QR code to get its ID
  const insertedQr = await db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.code, code))
    .limit(1);

  return {
    id: insertedQr[0]?.id || 0,
    code,
    accessUrl,
    createdAt: new Date(),
  };
}

export async function listActiveQrCodes() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.isActive, 1))
    .orderBy(desc(qrCodes.createdAt), desc(qrCodes.id));
}

export async function deactivateQrCode(codeId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.update(qrCodes).set({ isActive: 0 }).where(eq(qrCodes.id, codeId));

  return { success: true as const };
}

export async function createTestAccounts() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  // メールアドレスの重複チェック
  const existingAdmin = await db.select().from(users).where(eq(users.email, "test-admin@lab-coffee.local")).limit(1);
  const existingUser = await db.select().from(users).where(eq(users.email, "test-user@lab-coffee.local")).limit(1);

  if (existingAdmin.length > 0 || existingUser.length > 0) {
    throw new Error("テストアカウントは既に存在します。重複したメールアドレスのアカウントがあります。");
  }

  const adminOpenId = `test-admin-${nanoid(8)}`;
  const userOpenId = `test-user-${nanoid(8)}`;

  // テスト用管理者アカウント
  await db.insert(users).values({
    openId: adminOpenId,
    name: "テスト管理者",
    displayName: "テスト管理者",
    email: "test-admin@lab-coffee.local",
    loginMethod: "test",
    role: "admin",
    isTestAccount: 1,
  });

  // テスト用一般ユーザーアカウント
  await db.insert(users).values({
    openId: userOpenId,
    name: "テストユーザー",
    displayName: "テストユーザー",
    email: "test-user@lab-coffee.local",
    loginMethod: "test",
    role: "user",
    isTestAccount: 1,
  });

  // 両アカウントのウォレットを初期化
  const adminUser = await db.select().from(users).where(eq(users.openId, adminOpenId)).limit(1);
  const regularUser = await db.select().from(users).where(eq(users.openId, userOpenId)).limit(1);

  if (adminUser[0]) {
    await db.insert(ticketWallets).values({
      userId: adminUser[0].id,
      balance: 0,
    });
  }

  if (regularUser[0]) {
    await db.insert(ticketWallets).values({
      userId: regularUser[0].id,
      balance: 0,
    });
  }

  return {
    adminAccount: {
      openId: adminOpenId,
      name: "テスト管理者",
      email: "test-admin@lab-coffee.local",
      role: "admin",
      password: "1111",
    },
    userAccount: {
      openId: userOpenId,
      name: "テストユーザー",
      email: "test-user@lab-coffee.local",
      role: "user",
      password: "1234567890@abc",
    },
  };
}


export async function getUserUsageStats() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  // ユーザーごとの統計情報を取得
  const userStats = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      displayName: users.displayName,
      role: users.role,
      totalConsumptions: sql<number>`COALESCE(SUM(CASE WHEN ${ticketTransactions.type} = 'consume' THEN 1 ELSE 0 END), 0)`,
      totalPurchasedTickets: sql<number>`COALESCE(SUM(CASE WHEN ${ticketTransactions.type} = 'purchaseGrant' THEN ${ticketTransactions.delta} ELSE 0 END), 0)`,
      currentBalance: sql<number>`COALESCE(${ticketWallets.balance}, 0)`,
    })
    .from(users)
    .leftJoin(ticketTransactions, eq(users.id, ticketTransactions.userId))
    .leftJoin(ticketWallets, eq(users.id, ticketWallets.userId))
    // Include both user and admin roles
    // .where(eq(users.role, "user"))
    .groupBy(users.id, users.name, users.email, users.displayName, ticketWallets.balance)
    .orderBy(desc(sql<number>`COALESCE(SUM(CASE WHEN ${ticketTransactions.type} = 'consume' THEN 1 ELSE 0 END), 0)`));

  return userStats.map(stat => ({
    userId: stat.userId,
    userName: stat.userName,
    userEmail: stat.userEmail,
    displayName: stat.displayName,
    role: stat.role,
    totalConsumptions: Number(stat.totalConsumptions ?? 0),
    totalPurchasedTickets: Number(stat.totalPurchasedTickets ?? 0),
    currentBalance: Number(stat.currentBalance ?? 0),
  }));
}


export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  // ユーザーに関連するすべてのデータを削除
  // 1. チケットウォレットを削除
  await db.delete(ticketWallets).where(eq(ticketWallets.userId, userId));

  // 2. チケットトランザクション（利用ログ）を削除
  await db.delete(ticketTransactions).where(eq(ticketTransactions.userId, userId));

  // 3. 購入申請を削除
  await db.delete(purchaseRequests).where(eq(purchaseRequests.userId, userId));

  // 4. ユーザー自体を削除
  await db.delete(users).where(eq(users.id, userId));

  return { success: true as const };
}

export async function deleteUsageLog(logId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.delete(ticketTransactions).where(eq(ticketTransactions.id, logId));

  return { success: true as const };
}

export async function listTestAccounts() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      isTestAccount: users.isTestAccount,
    })
    .from(users)
    .where(eq(users.isTestAccount, 1))
    .orderBy(desc(users.createdAt));
}

export async function deleteTestAccounts() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  // Delete all test accounts and their related data
  const testAccounts = await db.select({ id: users.id }).from(users).where(eq(users.isTestAccount, 1));

  for (const account of testAccounts) {
    await deleteUser(account.id);
  }

  return { deletedCount: testAccounts.length };
}


export async function deleteCoffeeBean(beanId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  await db.delete(coffeeBeans).where(eq(coffeeBeans.id, beanId));
  return { success: true as const };
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return { success: true as const };
}


export async function updateTicketBalance(userId: number, newBalance: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  
  // Validate input
  if (newBalance < 0) {
    throw new Error("チケット枚数は0以上である必要があります");
  }
  
  // Get current balance
  const wallet = await db.select().from(ticketWallets).where(eq(ticketWallets.userId, userId));
  
  if (!wallet.length) {
    throw new Error("ユーザーのチケットウォレットが見つかりません");
  }
  
  // Get total purchased tickets to validate upper limit
  const purchaseList = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.userId, userId));
  
  const totalPurchasedTickets = purchaseList.reduce((sum, req) => sum + req.ticketCount, 0);
  
  // Validate that new balance does not exceed total purchased tickets
  if (newBalance > totalPurchasedTickets) {
    throw new Error(`チケット枚数は購入枚数（${totalPurchasedTickets}枚）を超えることはできません`);
  }
  
  const currentBalance = wallet[0].balance;
  const delta = newBalance - currentBalance;
  
  // Update wallet balance
  await db.update(ticketWallets).set({ balance: newBalance }).where(eq(ticketWallets.userId, userId));
  
  // Record transaction
  if (delta !== 0) {
    await db.insert(ticketTransactions).values({
      userId,
      type: delta > 0 ? "purchaseGrant" : "consume",
      sourceType: "adminAction",
      delta: Math.abs(delta),
      createdAt: new Date(),
    });
  }
  
  return { success: true as const };
}


// Instant purchase: 1 ticket for 70 yen
export const INSTANT_TICKET_PRICE_YEN = 70;
export const INSTANT_TICKET_COUNT = 1;

export async function instantPurchaseTicket(userId: number, paymentMethod: PaymentMethod) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  
  // Validate payment method
  if (!["paypay", "cash"].includes(paymentMethod)) {
    throw new Error("無効な支払方法です");
  }
  
  // Get current wallet
  const wallet = await db.select().from(ticketWallets).where(eq(ticketWallets.userId, userId));
  
  if (!wallet.length) {
    throw new Error("ユーザーのチケットウォレットが見つかりません");
  }
  
  const currentBalance = wallet[0].balance;
  const newBalance = currentBalance + INSTANT_TICKET_COUNT;
  
  // Update wallet balance
  await db.update(ticketWallets).set({ balance: newBalance }).where(eq(ticketWallets.userId, userId));
  
  // Record transaction with instantPurchase tag
  await db.insert(ticketTransactions).values({
    userId,
    type: "purchaseGrant",
    sourceType: "instantPurchase",
    purchaseTag: "instantPurchase",
    delta: INSTANT_TICKET_COUNT,
    purchaseRequestId: null,
    performedByUserId: null,
    createdAt: new Date(),
  });
  
  return { 
    success: true as const,
    newBalance,
    ticketCount: INSTANT_TICKET_COUNT,
    priceYen: INSTANT_TICKET_PRICE_YEN,
    paymentMethod,
  };
}
