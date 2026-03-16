import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { nanoid } from "nanoid";

const resend = new Resend(process.env.RESEND_API_KEY);

// -------------------------------------------------------
// application/accepted — generate assignment code + notify
// -------------------------------------------------------
export const onApplicationAccepted = inngest.createFunction(
  { id: "application-accepted", name: "Application Accepted" },
  { event: "application/accepted" },
  async ({ event }) => {
    const { applicationId } = event.data as { applicationId: string };

    const assignmentCode = nanoid(12).toUpperCase();

    const app = await prisma.application.update({
      where: { id: applicationId },
      data: { assignmentCode, reviewedAt: new Date() },
      include: {
        user: true,
        gig: { include: { company: true } },
      },
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: "application_accepted",
        title: "Application accepted!",
        body: `You have been accepted to "${app.gig.title}". Your assignment code is ${assignmentCode}.`,
        metadata: { gigId: app.gigId, applicationId },
      },
    });

    // Email
    await resend.emails.send({
      from: "DataGigs <onboarding@resend.dev>",
      to: app.user.email,
      subject: `You're in! Assignment code for "${app.gig.title}"`,
      html: `
        <h2>Your application was accepted!</h2>
        <p>Gig: <strong>${app.gig.title}</strong></p>
        <p>Your assignment code: <strong>${assignmentCode}</strong></p>
        <p>Use this code in the DataGigs app to submit your sensor data.</p>
      `,
    });

    return { assignmentCode };
  }
);

// -------------------------------------------------------
// application/denied
// -------------------------------------------------------
export const onApplicationDenied = inngest.createFunction(
  { id: "application-denied", name: "Application Denied" },
  { event: "application/denied" },
  async ({ event }) => {
    const { applicationId } = event.data as { applicationId: string };

    const app = await prisma.application.update({
      where: { id: applicationId },
      data: { reviewedAt: new Date() },
      include: { user: true, gig: true },
    });

    await prisma.notification.create({
      data: {
        userId: app.userId,
        type: "application_denied",
        title: "Application not selected",
        body: `Your application to "${app.gig.title}" was not selected this time.`,
        metadata: { gigId: app.gigId, applicationId },
      },
    });

    await resend.emails.send({
      from: "DataGigs <onboarding@resend.dev>",
      to: app.user.email,
      subject: `Application update for "${app.gig.title}"`,
      html: `
        <p>Thank you for applying to <strong>${app.gig.title}</strong>.</p>
        <p>Unfortunately, your application was not selected. Keep an eye out for other gigs!</p>
      `,
    });
  }
);

// -------------------------------------------------------
// submission/verify — stub verification, then credit user
// -------------------------------------------------------
export const onSubmissionVerify = inngest.createFunction(
  { id: "submission-verify", name: "Submission Verify" },
  { event: "submission/verify" },
  async ({ event }) => {
    const { submissionId } = event.data as { submissionId: string };

    const submission = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        gigLabel: true,
        application: { include: { user: true, gig: { include: { company: true } } } },
      },
    });

    // TODO: replace stub with real verification service
    const verificationPassed = true;

    if (!verificationPassed) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "rejected", verifiedAt: new Date() },
      });

      await prisma.notification.create({
        data: {
          userId: submission.application.userId,
          type: "submission_rejected",
          title: "Submission not accepted",
          body: `Your submission for "${submission.gigLabel.labelName}" was rejected.`,
          metadata: { submissionId },
        },
      });
      return { accepted: false };
    }

    // Credit transaction in a DB transaction
    await prisma.$transaction([
      prisma.submission.update({
        where: { id: submissionId },
        data: { status: "accepted", verifiedAt: new Date() },
      }),
      prisma.ledgerEntry.create({
        data: {
          type: "escrow_release",
          amountCents: submission.gigLabel.rateCents,
          companyId: submission.application.gig.companyId,
          userId: submission.application.userId,
          submissionId,
          description: `Accepted: ${submission.gigLabel.labelName}`,
        },
      }),
      prisma.userProfile.update({
        where: { userId: submission.application.userId },
        data: {
          creditsBalanceCents: { increment: submission.gigLabel.rateCents },
        },
      }),
      prisma.gigLabel.update({
        where: { id: submission.gigLabelId },
        data: { quantityFulfilled: { increment: 1 } },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: submission.application.userId,
        type: "submission_accepted",
        title: "Submission accepted!",
        body: `+$${(submission.gigLabel.rateCents / 100).toFixed(2)} added to your balance.`,
        metadata: { submissionId },
      },
    });

    // Trigger gig completion check
    await inngest.send({
      name: "gig/check-completion",
      data: { gigId: submission.application.gigId },
    });

    return { accepted: true, rateCents: submission.gigLabel.rateCents };
  }
);

// -------------------------------------------------------
// gig/check-completion
// -------------------------------------------------------
export const onGigCheckCompletion = inngest.createFunction(
  { id: "gig-check-completion", name: "Gig Check Completion" },
  { event: "gig/check-completion" },
  async ({ event }) => {
    const { gigId } = event.data as { gigId: string };

    const labels = await prisma.gigLabel.findMany({ where: { gigId } });
    const allFulfilled = labels.every((l: { quantityFulfilled: number; quantityNeeded: number }) => l.quantityFulfilled >= l.quantityNeeded);

    if (allFulfilled) {
      await prisma.gig.update({
        where: { id: gigId },
        data: { status: "completed" },
      });

      const gig = await prisma.gig.findUnique({
        where: { id: gigId },
        include: { company: { include: { user: true } } },
      });

      if (gig) {
        await prisma.notification.create({
          data: {
            userId: gig.companyId,
            type: "gig_cancelled",
            title: "Gig completed!",
            body: `"${gig.title}" has collected all required data.`,
            metadata: { gigId },
          },
        });
      }
    }
  }
);

// -------------------------------------------------------
// payout/process
// -------------------------------------------------------
export const onPayoutProcess = inngest.createFunction(
  { id: "payout-process", name: "Payout Process" },
  { event: "payout/process" },
  async ({ event }) => {
    const { payoutRequestId } = event.data as { payoutRequestId: string };

    const payoutRequest = await prisma.payoutRequest.findUniqueOrThrow({
      where: { id: payoutRequestId },
      include: { user: { include: { userProfile: true } } },
    });

    const stripeAccountId = payoutRequest.user.userProfile?.stripeAccountId;
    if (!stripeAccountId) throw new Error("No Stripe account connected");

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const transfer = await stripe.transfers.create({
      amount: payoutRequest.amountCents,
      currency: "usd",
      destination: stripeAccountId,
      metadata: { payoutRequestId },
    });

    await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: payoutRequestId },
        data: { status: "in_transit", stripeTransferId: transfer.id },
      }),
      prisma.ledgerEntry.create({
        data: {
          type: "payout",
          amountCents: payoutRequest.amountCents,
          userId: payoutRequest.userId,
          stripeTransferId: transfer.id,
          description: "Payout initiated",
        },
      }),
      prisma.userProfile.update({
        where: { userId: payoutRequest.userId },
        data: {
          creditsBalanceCents: { decrement: payoutRequest.amountCents },
        },
      }),
    ]);

    return { transferId: transfer.id };
  }
);

// -------------------------------------------------------
// payout/completed
// -------------------------------------------------------
export const onPayoutCompleted = inngest.createFunction(
  { id: "payout-completed", name: "Payout Completed" },
  { event: "payout/completed" },
  async ({ event }) => {
    const { stripeTransferId } = event.data as { stripeTransferId: string };

    const payoutRequest = await prisma.payoutRequest.update({
      where: { stripeTransferId },
      data: { status: "paid", completedAt: new Date() },
      include: { user: true },
    });

    await prisma.notification.create({
      data: {
        userId: payoutRequest.userId,
        type: "payout_sent",
        title: "Payout sent!",
        body: `$${(payoutRequest.amountCents / 100).toFixed(2)} has been sent to your bank account.`,
        metadata: { payoutRequestId: payoutRequest.id },
      },
    });

    await resend.emails.send({
      from: "DataGigs <onboarding@resend.dev>",
      to: payoutRequest.user.email,
      subject: "Your payout is on the way",
      html: `
        <p>Your payout of <strong>$${(payoutRequest.amountCents / 100).toFixed(2)}</strong> is on its way to your bank account.</p>
      `,
    });
  }
);

export const functions = [
  onApplicationAccepted,
  onApplicationDenied,
  onSubmissionVerify,
  onGigCheckCompletion,
  onPayoutProcess,
  onPayoutCompleted,
];
