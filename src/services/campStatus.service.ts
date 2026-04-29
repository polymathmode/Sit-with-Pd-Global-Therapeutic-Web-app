import prisma from '../config/prisma';

export type CampStatusTransitionResult = {
  upcomingToOngoing: number;
  ongoingToCompleted: number;
};

/**
 * Advances camp status by wall-clock dates:
 * - UPCOMING → ONGOING when now >= startDate
 * - ONGOING → COMPLETED when now > endDate
 *
 * Order: UPCOMING→ONGOING first so a long-past camp becomes ONGOING then COMPLETED in one run.
 */
export async function processCampStatusTransitions(): Promise<CampStatusTransitionResult> {
  const now = new Date();

  const upcomingToOngoing = await prisma.camp.updateMany({
    where: {
      status: 'UPCOMING',
      startDate: { lte: now },
    },
    data: { status: 'ONGOING' },
  });

  const ongoingToCompleted = await prisma.camp.updateMany({
    where: {
      status: 'ONGOING',
      endDate: { lt: now },
    },
    data: { status: 'COMPLETED' },
  });

  const result: CampStatusTransitionResult = {
    upcomingToOngoing: upcomingToOngoing.count,
    ongoingToCompleted: ongoingToCompleted.count,
  };

  if (result.upcomingToOngoing > 0 || result.ongoingToCompleted > 0) {
    console.log(
      `[camp-status] Transitioned ${result.upcomingToOngoing} camp(s) UPCOMING→ONGOING, ${result.ongoingToCompleted} camp(s) ONGOING→COMPLETED.`
    );
  }

  return result;
}
