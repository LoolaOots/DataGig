import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existing?.processed) {
    return NextResponse.json({ received: true, skipped: true });
  }

  // Log event
  await prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      type: event.type,
      rawPayload: event as unknown as Record<string, string | number | boolean | null>,
    },
    update: {},
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const amountCents = parseInt(session.metadata?.amountCents ?? "0");

        if (userId && amountCents > 0 && session.payment_status === "paid") {
          await prisma.$transaction([
            prisma.companyProfile.update({
              where: { userId },
              data: { balanceCents: { increment: amountCents } },
            }),
            prisma.ledgerEntry.create({
              data: {
                type: "deposit",
                amountCents,
                companyId: userId,
                stripePaymentIntentId:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : undefined,
                description: "Stripe checkout deposit",
              },
            }),
          ]);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        // Log failure — could notify company here
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const isComplete =
          account.charges_enabled && account.payouts_enabled;

        if (isComplete) {
          await prisma.userProfile.updateMany({
            where: { stripeAccountId: account.id },
            data: { stripeOnboardingComplete: true },
          });
        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        // Find the transfer associated with this payout
        if (payout.destination) {
          const destId =
            typeof payout.destination === "string"
              ? payout.destination
              : payout.destination.id;

          // Find payout request by stripe account (approximate — transfer ID is more reliable)
          const payoutRequest = await prisma.payoutRequest.findFirst({
            where: {
              status: "in_transit",
              user: { userProfile: { stripeAccountId: destId } },
            },
          });

          if (payoutRequest?.stripeTransferId) {
            await inngest.send({
              name: "payout/completed",
              data: { stripeTransferId: payoutRequest.stripeTransferId },
            });
          }
        }
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        if (payout.destination) {
          const destId =
            typeof payout.destination === "string"
              ? payout.destination
              : payout.destination.id;

          await prisma.payoutRequest.updateMany({
            where: {
              status: "in_transit",
              user: { userProfile: { stripeAccountId: destId } },
            },
            data: {
              status: "failed",
              failureReason: payout.failure_message ?? "Payout failed",
            },
          });
        }
        break;
      }

      // @ts-expect-error: transfer.failed is not in Stripe's TypeScript union but is a real event
      case "transfer.failed": {
        const transfer = (event as unknown as { data: { object: Stripe.Transfer } }).data.object;
        await prisma.payoutRequest.updateMany({
          where: { stripeTransferId: transfer.id },
          data: { status: "failed", failureReason: "Transfer failed" },
        });
        break;
      }
    }

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (err) {
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { error: String(err) },
    });
    throw err;
  }

  return NextResponse.json({ received: true });
}
