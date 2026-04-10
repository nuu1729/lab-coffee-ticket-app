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
  getDashboardData,
  getUsageStatsSummary,
  getUserPurchaseRequests,
  listCoffeeBeans,
  listPendingPurchaseRequests,
  listUsageLogs,
  saveCoffeeBean,
} from "./db";

const purchaseRequestInput = z.object({
  planCode: z.enum(["ten", "twentyFive"]),
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
  }),
  stats: router({
    summary: adminProcedure.query(async () => {
      return getUsageStatsSummary();
    }),
  }),
});

export type AppRouter = typeof appRouter;
