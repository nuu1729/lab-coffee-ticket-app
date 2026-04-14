import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  approvePurchaseRequest,
  consumeTicketViaQr,
  createPurchaseRequest,
  createTestAccounts,
  deactivateQrCode,
  deleteCoffeeBean,
  deleteTestAccounts,
  deleteUser,
  deleteUsageLog,
  generateQrCode,
  createInstantPurchaseRequest,
  updateTicketBalance,
  getDashboardData,
  getDb,
  getTicketPlanDefinition,
  getUsageStatsSummary,
  getUserById,
  getUserPurchaseRequests,
  getUserUsageStats,
  listActiveQrCodes,
  listCoffeeBeans,
  listPendingPurchaseRequests,
  listTestAccounts,
  listUsageLogs,
  saveCoffeeBean,
  updateUserDisplayName,
  updateUserRole,
} from "./db";

const purchaseRequestInput = z.object({
  planCode: z.enum(["ten", "twentyFour"]),
  paymentMethod: z.enum(["paypay", "cash"]),
  note: z.string().max(300).optional().nullable(),
});

const coffeeBeanInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  features: z.string().max(1000).optional().nullable(),
  priceYen: z.number().int().min(0),
  isActive: z.number().int().min(0).max(1).default(1),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  user: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      return getUserById(ctx.user.id);
    }),
    updateDisplayName: protectedProcedure
      .input(z.object({ displayName: z.string().min(1).max(120) }))
      .mutation(async ({ ctx, input }) => {
        return updateUserDisplayName(ctx.user.id, input.displayName);
      }),
  }),
  ticket: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardData(ctx.user.id);
    }),
    purchaseHistory: protectedProcedure.query(async ({ ctx }) => {
      return getUserPurchaseRequests(ctx.user.id);
    }),
    createPurchaseRequest: protectedProcedure
      .input(purchaseRequestInput)
      .mutation(async ({ ctx, input }) => {
        return createPurchaseRequest({
          userId: ctx.user.id,
          planCode: input.planCode,
          paymentMethod: input.paymentMethod,
          note: input.note ?? null,
          isTestRequest: ctx.user.isTestAccount === 1,
        });
      }),
    qrAccess: protectedProcedure.query(async ({ ctx }) => {
      const dashboard = await getDashboardData(ctx.user.id);
      return {
        balance: dashboard.wallet.balance,
        activeBean: dashboard.activeBean,
      };
    }),
    consumeViaQr: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await consumeTicketViaQr(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "チケットの利用に失敗しました",
        });
      }
    }),
    instantPurchase: protectedProcedure
      .input(
        z.object({
          paymentMethod: z.enum(["paypay", "cash"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await createInstantPurchaseRequest(ctx.user.id, input.paymentMethod);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "即時購入に失敗しました",
          });
        }
      }),
  }),
  admin: router({
    pendingPurchaseRequests: adminProcedure.query(async () => {
      return listPendingPurchaseRequests();
    }),
    approvePurchaseRequest: adminProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await approvePurchaseRequest({
            requestId: input.requestId,
            adminUserId: ctx.user.id,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "購入申請の承認に失敗しました",
          });
        }
      }),
    coffeeBeans: adminProcedure.query(async () => {
      return listCoffeeBeans();
    }),
    saveCoffeeBean: adminProcedure.input(coffeeBeanInput).mutation(async ({ input }) => {
      return saveCoffeeBean({
        id: input.id,
        name: input.name,
        features: input.features ?? null,
        priceYen: input.priceYen,
        isActive: input.isActive,
      });
    }),
    usageLogs: adminProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(500).default(100),
        })
      )
      .query(async ({ input }) => {
        return listUsageLogs(input.limit);
      }),
    qrCodes: adminProcedure.query(async () => {
      return listActiveQrCodes();
    }),
    generateQrCode: adminProcedure
      .input(z.object({ baseUrl: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await generateQrCode(ctx.user.id, input.baseUrl);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "QRコード生成に失敗しました",
          });
        }
      }),
    deactivateQrCode: adminProcedure
      .input(z.object({ codeId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await deactivateQrCode(input.codeId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "QRコード無効化に失敗しました",
          });
        }
      }),
    createTestAccounts: adminProcedure.mutation(async () => {
      try {
        return await createTestAccounts();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "テストアカウント作成に失敗しました",
        });
      }
    }),
    userUsageStats: adminProcedure.query(async () => {
      try {
        return await getUserUsageStats();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "利用者統計の取得に失敗しました",
        });
      }
    }),
    testAccounts: adminProcedure.query(async () => {
      try {
        return await listTestAccounts();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "テストアカウント一覧の取得に失敗しました",
        });
      }
    }),
    deleteTestAccounts: adminProcedure.mutation(async () => {
      try {
        return await deleteTestAccounts();
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "テストアカウント削除に失敗しました",
        });
      }
    }),
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteUser(input.userId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "ユーザー削除に失敗しました",
          });
        }
      }),
    deleteCoffeeBean: adminProcedure
      .input(z.object({ beanId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteCoffeeBean(input.beanId);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "豆情報の削除に失敗しました",
          });
        }
      }),
    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input }) => {
        try {
          return await updateUserRole(input.userId, input.role);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "ユーザー権限の更新に失敗しました",
          });
        }
      }),
    updateTicketBalance: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), newBalance: z.number().int().min(0) }))
      .mutation(async ({ input }) => {
        try {
          return await updateTicketBalance(input.userId, input.newBalance);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "チケット枚数の更新に失敗しました",
          });
        }
      }),
  }),
  stats: router({
    summary: adminProcedure.query(async () => {
      return getUsageStatsSummary();
    }),
  }),
});

export type AppRouter = typeof appRouter;
