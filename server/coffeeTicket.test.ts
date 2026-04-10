import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const dbMock = vi.hoisted(() => ({
  approvePurchaseRequest: vi.fn(),
  consumeTicketViaQr: vi.fn(),
  createPurchaseRequest: vi.fn(),
  getDashboardData: vi.fn(),
  getUsageStatsSummary: vi.fn(),
  getUserPurchaseRequests: vi.fn(),
  listCoffeeBeans: vi.fn(),
  listPendingPurchaseRequests: vi.fn(),
  listUsageLogs: vi.fn(),
  saveCoffeeBean: vi.fn(),
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
});
