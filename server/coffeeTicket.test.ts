import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const dbMock = vi.hoisted(() => ({
  approvePurchaseRequest: vi.fn(),
  consumeTicketViaQr: vi.fn(),
  createPurchaseRequest: vi.fn(),
  createTestAccounts: vi.fn(),
  deactivateQrCode: vi.fn(),
  generateQrCode: vi.fn(),
  getDashboardData: vi.fn(),
  getUsageStatsSummary: vi.fn(),
  getUserById: vi.fn(),
  getUserPurchaseRequests: vi.fn(),
  getUserUsageStats: vi.fn(),
  listActiveQrCodes: vi.fn(),
  listCoffeeBeans: vi.fn(),
  listPendingPurchaseRequests: vi.fn(),
  listUsageLogs: vi.fn(),
  saveCoffeeBean: vi.fn(),
  updateUserDisplayName: vi.fn(),
}));

vi.mock("./db", () => dbMock);

type Role = "user" | "admin";
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: Role = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 99 : 1,
    openId: `${role}-open-id`,
    email: `${role}@example.com`,
    name: role === "admin" ? "Admin User" : "Regular User",
    loginMethod: "manus",
    role,
    isTestAccount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
}

describe("coffee ticket routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a purchase request for the signed-in user", async () => {
    dbMock.createPurchaseRequest.mockResolvedValue({ id: 10, status: "pending" });

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.ticket.createPurchaseRequest({
      planCode: "ten",
      paymentMethod: "paypay",
      note: null,
    });

    expect(result).toEqual({ id: 10, status: "pending" });
    expect(dbMock.createPurchaseRequest).toHaveBeenCalledWith({
      userId: 1,
      planCode: "ten",
      paymentMethod: "paypay",
      note: null,
      isTestRequest: false,
    });
  });

  it("returns QR access data from the dashboard helper", async () => {
    dbMock.getDashboardData.mockResolvedValue({
      wallet: { balance: 7 },
      activeBean: {
        id: 3,
        name: "Ethiopia Guji",
        features: "Floral and citrus",
        priceYen: 1200,
      },
    });

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.ticket.qrAccess();

    expect(result).toEqual({
      balance: 7,
      activeBean: {
        id: 3,
        name: "Ethiopia Guji",
        features: "Floral and citrus",
        priceYen: 1200,
      },
    });
    expect(dbMock.getDashboardData).toHaveBeenCalledWith(1);
  });

  it("wraps QR consumption failures as user-friendly errors", async () => {
    dbMock.consumeTicketViaQr.mockRejectedValue(new Error("残チケットが不足しています"));

    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.ticket.consumeViaQr()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "残チケットが不足しています",
    });
  });

  it("blocks regular users from opening admin endpoints", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.pendingPurchaseRequests()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows administrators to approve requests and forwards admin metadata", async () => {
    dbMock.approvePurchaseRequest.mockResolvedValue({
      id: 77,
      status: "approved",
      grantedTicketCount: 25,
    });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.approvePurchaseRequest({ requestId: 77 });

    expect(result).toEqual({
      id: 77,
      status: "approved",
      grantedTicketCount: 25,
    });
    expect(dbMock.approvePurchaseRequest).toHaveBeenCalledWith({
      requestId: 77,
      adminUserId: 99,
    });
  });

  it("returns the prepared summary payload for statistics screens", async () => {
    dbMock.getUsageStatsSummary.mockResolvedValue({
      totalConsumptions: 14,
      totalGrantedTickets: 35,
      totalPendingRequests: 2,
      activeBean: {
        id: 2,
        name: "Kenya AA",
        priceYen: 1100,
        updatedAt: new Date("2026-04-10T00:00:00Z"),
      },
      generatedAt: 1712700000000,
    });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.stats.summary();

    expect(result.totalConsumptions).toBe(14);
    expect(result.totalGrantedTickets).toBe(35);
    expect(result.totalPendingRequests).toBe(2);
    expect(result.activeBean?.name).toBe("Kenya AA");
    expect(dbMock.getUsageStatsSummary).toHaveBeenCalledTimes(1);
  });

  it("allows users to update their display name", async () => {
    dbMock.updateUserDisplayName.mockResolvedValue({
      id: 1,
      name: "Updated Name",
      email: "user@example.com",
    });

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.user.updateDisplayName({ displayName: "Updated Name" });

    expect(result).toEqual({
      id: 1,
      name: "Updated Name",
      email: "user@example.com",
    });
    expect(dbMock.updateUserDisplayName).toHaveBeenCalledWith(1, "Updated Name");
  });

  it("allows admins to generate QR codes", async () => {
    dbMock.generateQrCode.mockResolvedValue({
      id: 5,
      code: "QR_ABC123",
      accessUrl: "https://example.com/use?qr=QR_ABC123",
    });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.generateQrCode({ baseUrl: "https://example.com" });

    expect(result).toEqual({
      id: 5,
      code: "QR_ABC123",
      accessUrl: "https://example.com/use?qr=QR_ABC123",
    });
    expect(dbMock.generateQrCode).toHaveBeenCalledWith(99, "https://example.com");
  });

  it("blocks regular users from generating QR codes", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.generateQrCode({ baseUrl: "https://example.com" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admins to create test accounts", async () => {
    dbMock.createTestAccounts.mockResolvedValue({
      adminAccount: { id: 100, name: "Test Admin", email: "test-admin@lab.local" },
      userAccount: { id: 101, name: "Test User", email: "test-user@lab.local" },
    });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.createTestAccounts();

    expect(result.adminAccount.name).toBe("Test Admin");
    expect(result.userAccount.name).toBe("Test User");
    expect(dbMock.createTestAccounts).toHaveBeenCalledTimes(1);
  });

  it("blocks regular users from creating test accounts", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.createTestAccounts()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

  it("allows admins to fetch user usage stats", async () => {
    dbMock.getUserUsageStats.mockResolvedValue([
      {
        userId: 1,
        userName: "User One",
        userEmail: "user1@example.com",
        displayName: "User One",
        totalConsumptions: 5,
        totalPurchasedTickets: 10,
        currentBalance: 5,
      },
      {
        userId: 2,
        userName: "User Two",
        userEmail: "user2@example.com",
        displayName: "User Two",
        totalConsumptions: 3,
        totalPurchasedTickets: 25,
        currentBalance: 22,
      },
    ]);

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.userUsageStats();

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe(1);
    expect(result[0].totalConsumptions).toBe(5);
    expect(result[1].currentBalance).toBe(22);
    expect(dbMock.getUserUsageStats).toHaveBeenCalledTimes(1);
  });

  it("blocks regular users from fetching user usage stats", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.userUsageStats()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admins to delete coffee beans", async () => {
    dbMock.deleteCoffeeBean = vi.fn().mockResolvedValue({ success: true });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.deleteCoffeeBean({ beanId: 1 });

    expect(result).toEqual({ success: true });
    expect(dbMock.deleteCoffeeBean).toHaveBeenCalledWith(1);
  });

  it("blocks regular users from deleting coffee beans", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.deleteCoffeeBean({ beanId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admins to update user roles", async () => {
    dbMock.updateUserRole = vi.fn().mockResolvedValue({ success: true });

    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.admin.updateUserRole({ userId: 1, role: "admin" });

    expect(result).toEqual({ success: true });
    expect(dbMock.updateUserRole).toHaveBeenCalledWith(1, "admin");
  });

  it("blocks regular users from updating user roles", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.admin.updateUserRole({ userId: 1, role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows instant purchase with payment method selection", async () => {
    dbMock.instantPurchaseTicket = vi.fn().mockResolvedValue({
      success: true,
      newBalance: 40,
      ticketCount: 1,
      priceYen: 70,
      paymentMethod: "paypay",
    });

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.ticket.instantPurchase({
      paymentMethod: "paypay",
    });

    expect(result).toEqual({
      success: true,
      newBalance: 40,
      ticketCount: 1,
      priceYen: 70,
      paymentMethod: "paypay",
    });
    expect(dbMock.instantPurchaseTicket).toHaveBeenCalledWith(1, "paypay");
  });

  it("supports cash payment method for instant purchase", async () => {
    dbMock.instantPurchaseTicket = vi.fn().mockResolvedValue({
      success: true,
      newBalance: 41,
      ticketCount: 1,
      priceYen: 70,
      paymentMethod: "cash",
    });

    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.ticket.instantPurchase({
      paymentMethod: "cash",
    });

    expect(result.paymentMethod).toBe("cash");
    expect(dbMock.instantPurchaseTicket).toHaveBeenCalledWith(1, "cash");
  });

  it("wraps instant purchase failures as user-friendly errors", async () => {
    dbMock.instantPurchaseTicket = vi.fn().mockRejectedValue(new Error("無効な支払方法です"));

    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.ticket.instantPurchase({ paymentMethod: "paypay" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "無効な支払方法です",
    });
  });
