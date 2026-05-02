import prisma from '../config/prisma';
import type { Prisma } from '@prisma/client';

const programDashboardInclude = {
  weeks: {
    orderBy: { order: 'asc' as const },
    include: {
      modules: { orderBy: { order: 'asc' as const } },
    },
  },
} satisfies Prisma.ProgramInclude;

export { programDashboardInclude };

export type ProgramDashboardRecord = Prisma.ProgramGetPayload<{
  include: typeof programDashboardInclude;
}>;

export type WeekProgressRow = {
  weekId: string;
  title: string;
  order: number;
  moduleCount: number;
  modulesCompletedCount: number;
  isWeekComplete: boolean;
};

export type ProgramProgressOverview = {
  totalWeeks: number;
  /** Weeks with every module completed (weeks with zero modules count as complete). */
  completedWeeks: number;
  /**
   * `ProgramWeek.order` of the earliest week that still has incomplete modules.
   * Null when every week is complete or there are no weeks with modules left to finish.
   */
  currentWeekDisplayOrder: number | null;
  totalModules: number;
  completedModules: number;
  /** 0 when there are no modules; otherwise rounded 0–100. */
  percentComplete: number;
  /** True iff every module in the program has a completion row. */
  isProgramCompleted: boolean;
  /** ISO timestamp when the programme was fully completed; mirrors `purchase.programCompletedAt`. */
  programCompletedAt: string | null;
  weeks: WeekProgressRow[];
};

type WeekBlock = {
  id: string;
  title: string;
  order: number;
  modules: { id: string }[];
};

export function computeProgramProgressFromWeeks(
  weeks: WeekBlock[],
  completedByModuleId: Map<string, Date>
): Omit<ProgramProgressOverview, 'isProgramCompleted' | 'programCompletedAt'> & {
  allModulesComplete: boolean;
} {
  const sortedWeeks = [...weeks].sort((a, b) => a.order - b.order);

  const weekSummaries: WeekProgressRow[] = sortedWeeks.map((w) => {
    const moduleCount = w.modules.length;
    const modulesCompletedCount = w.modules.filter((m) => completedByModuleId.has(m.id)).length;
    const isWeekComplete = moduleCount === 0 || modulesCompletedCount === moduleCount;

    return {
      weekId: w.id,
      title: w.title,
      order: w.order,
      moduleCount,
      modulesCompletedCount,
      isWeekComplete,
    };
  });

  const moduleIdsInProgram = new Set(
    sortedWeeks.flatMap((w) => w.modules.map((m) => m.id))
  );

  let completedModules = 0;
  for (const id of moduleIdsInProgram) {
    if (completedByModuleId.has(id)) completedModules += 1;
  }

  const totalModules = moduleIdsInProgram.size;

  const completedWeeks = weekSummaries.filter((r) => r.isWeekComplete).length;

  const firstIncompleteWeek = sortedWeeks.find((w) => {
    if (w.modules.length === 0) return false;
    return !w.modules.every((m) => completedByModuleId.has(m.id));
  });

  const allWeekModulesDone = sortedWeeks.every((w) => {
    if (w.modules.length === 0) return true;
    return w.modules.every((m) => completedByModuleId.has(m.id));
  });

  const currentWeekDisplayOrder =
    totalModules === 0 || allWeekModulesDone ? null : firstIncompleteWeek?.order ?? null;

  const percentComplete =
    totalModules === 0 ? 0 : Math.min(100, Math.round((completedModules / totalModules) * 100));

  const allModulesComplete = totalModules > 0 && completedModules === totalModules;

  return {
    totalWeeks: sortedWeeks.length,
    completedWeeks,
    currentWeekDisplayOrder,
    totalModules,
    completedModules,
    percentComplete,
    allModulesComplete,
    weeks: weekSummaries,
  };
}

/** Align `purchase.programCompletedAt` with computed completion (e.g. after admin deletes modules). */
export async function syncPurchaseProgramCompletion(
  userId: string,
  programId: string,
  allModulesComplete: boolean,
  existingProgramCompletedAt: Date | null
): Promise<void> {
  let nextCompletedAt: Date | null;

  if (allModulesComplete) {
    nextCompletedAt = existingProgramCompletedAt ?? new Date();
  } else {
    nextCompletedAt = null;
  }

  const unchanged =
    (existingProgramCompletedAt === null && nextCompletedAt === null) ||
    (existingProgramCompletedAt !== null &&
      nextCompletedAt !== null &&
      existingProgramCompletedAt.getTime() === nextCompletedAt.getTime());

  if (unchanged) return;

  await prisma.purchase.update({
    where: { userId_programId: { userId, programId } },
    data: { programCompletedAt: nextCompletedAt },
  });
}

function toOverview(
  core: ReturnType<typeof computeProgramProgressFromWeeks>,
  programCompletedAtDb: Date | null
): ProgramProgressOverview {
  return {
    totalWeeks: core.totalWeeks,
    completedWeeks: core.completedWeeks,
    currentWeekDisplayOrder: core.currentWeekDisplayOrder,
    totalModules: core.totalModules,
    completedModules: core.completedModules,
    percentComplete: core.percentComplete,
    weeks: core.weeks,
    isProgramCompleted: core.allModulesComplete,
    programCompletedAt:
      core.allModulesComplete && programCompletedAtDb ? programCompletedAtDb.toISOString() : null,
  };
}

async function fetchProgramWeekBlocks(programId: string): Promise<WeekBlock[]> {
  return prisma.programWeek.findMany({
    where: { programId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      order: true,
      modules: { orderBy: { order: 'asc' }, select: { id: true } },
    },
  });
}

async function fetchCompletionMapForProgram(
  userId: string,
  programId: string
): Promise<Map<string, Date>> {
  const rows = await prisma.programModuleCompletion.findMany({
    where: {
      userId,
      module: { week: { programId } },
    },
    select: { moduleId: true, completedAt: true },
  });
  return new Map(rows.map((r) => [r.moduleId, r.completedAt]));
}

/** Full progress rollup + reconciles purchase completion timestamp. */
export async function getProgramProgressOverview(
  userId: string,
  programId: string
): Promise<ProgramProgressOverview> {
  const [weeks, completedByModuleId, purchaseBefore] = await Promise.all([
    fetchProgramWeekBlocks(programId),
    fetchCompletionMapForProgram(userId, programId),
    prisma.purchase.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { programCompletedAt: true },
    }),
  ]);

  const core = computeProgramProgressFromWeeks(weeks, completedByModuleId);
  await syncPurchaseProgramCompletion(
    userId,
    programId,
    core.allModulesComplete,
    purchaseBefore?.programCompletedAt ?? null
  );

  const purchaseAfter = await prisma.purchase.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { programCompletedAt: true },
  });

  return toOverview(core, purchaseAfter?.programCompletedAt ?? null);
}

/** Batch-load progress for dashboard listings (reconciles all purchases in batch). */
export async function getProgressOverviewsForPrograms(
  userId: string,
  programIds: string[]
): Promise<Map<string, ProgramProgressOverview>> {
  const result = new Map<string, ProgramProgressOverview>();
  if (programIds.length === 0) return result;

  const programs = await prisma.program.findMany({
    where: { id: { in: programIds } },
    select: {
      id: true,
      weeks: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
          modules: { orderBy: { order: 'asc' }, select: { id: true } },
        },
      },
    },
  });

  const allModuleIds = programs.flatMap((p) =>
    p.weeks.flatMap((w) => w.modules.map((m) => m.id))
  );

  const completionsPromise =
    allModuleIds.length === 0
      ? Promise.resolve<Array<{ moduleId: string; completedAt: Date }>>([])
      : prisma.programModuleCompletion.findMany({
          where: { userId, moduleId: { in: allModuleIds } },
          select: { moduleId: true, completedAt: true },
        });

  const [completions, purchasesBefore] = await Promise.all([
    completionsPromise,
    prisma.purchase.findMany({
      where: { userId, programId: { in: programIds } },
      select: { programId: true, programCompletedAt: true },
    }),
  ]);

  const globalCompletionMap = new Map(
    completions.map((c: { moduleId: string; completedAt: Date }) => [c.moduleId, c.completedAt])
  );

  await Promise.all(
    programs.map((prog) => {
      const programScopedMap = new Map<string, Date>();
      for (const w of prog.weeks) {
        for (const m of w.modules) {
          const t = globalCompletionMap.get(m.id);
          if (t) programScopedMap.set(m.id, t);
        }
      }
      const core = computeProgramProgressFromWeeks(prog.weeks, programScopedMap);
      const rawExisting = purchasesBefore.find((row) => row.programId === prog.id)?.programCompletedAt;
      const existing: Date | null = rawExisting instanceof Date ? rawExisting : null;
      return syncPurchaseProgramCompletion(userId, prog.id, core.allModulesComplete, existing);
    })
  );

  const purchasesAfter = await prisma.purchase.findMany({
    where: { userId, programId: { in: programIds } },
    select: { programId: true, programCompletedAt: true },
  });
  const afterMap = new Map<string, Date | null>(
    purchasesAfter.map((p: { programId: string; programCompletedAt: Date | null }) => [
      p.programId,
      p.programCompletedAt,
    ])
  );

  for (const prog of programs) {
    const programScopedMap = new Map<string, Date>();
    for (const w of prog.weeks) {
      for (const m of w.modules) {
        const t = globalCompletionMap.get(m.id);
        if (t) programScopedMap.set(m.id, t);
      }
    }
    const core = computeProgramProgressFromWeeks(prog.weeks, programScopedMap);
    result.set(prog.id, toOverview(core, afterMap.get(prog.id) ?? null));
  }

  return result;
}

/** Idempotent completion row; verifies entitlement and module/program alignment. */
export async function completeProgramModule(params: {
  userId: string;
  programId: string;
  moduleId: string;
}) {
  const { userId, programId, moduleId } = params;

  const [purchase, mod] = await Promise.all([
    prisma.purchase.findUnique({
      where: { userId_programId: { userId, programId } },
      include: { payment: { select: { status: true } } },
    }),
    prisma.programModule.findFirst({
      where: {
        id: moduleId,
        week: { programId },
      },
      select: { id: true },
    }),
  ]);

  if (!mod) {
    return { ok: false as const, status: 404 as const, message: 'Module not found in this program.' };
  }

  if (!purchase || purchase.payment?.status !== 'SUCCESS') {
    return { ok: false as const, status: 403 as const, message: 'You have not purchased this program.' };
  }

  const existing = await prisma.programModuleCompletion.findUnique({
    where: {
      userId_moduleId: { userId, moduleId },
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.programModuleCompletion.create({
      data: { userId, moduleId },
    });
  }

  const progress = await getProgramProgressOverview(userId, programId);
  return { ok: true as const, progress };
}

/**
 * Full program tree for a purchaser with `completedAt` on each module and a `progress` rollup.
 */
export async function buildProgramDashboardPayload(
  userId: string,
  programId: string,
  program: ProgramDashboardRecord
) {
  const [completions, progress] = await Promise.all([
    prisma.programModuleCompletion.findMany({
      where: { userId, module: { week: { programId } } },
      select: { moduleId: true, completedAt: true },
    }),
    getProgramProgressOverview(userId, programId),
  ]);
  const map = new Map(
    completions.map((c: { moduleId: string; completedAt: Date }) => [
      c.moduleId,
      c.completedAt.toISOString(),
    ])
  );

  return {
    ...program,
    weeks: program.weeks.map((w) => ({
      ...w,
      modules: w.modules.map((m) => ({
        ...m,
        completedAt: map.get(m.id) ?? null,
      })),
    })),
    progress,
  };
}
