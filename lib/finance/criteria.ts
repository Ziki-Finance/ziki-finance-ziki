import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ParsedFinanceCriteriaInput } from "@/lib/validations/finance";

/**
 * Criteria storage for Finance (FIN-CR-013, Stream A). Every read and write is
 * scoped to one owner: Finance has no organisation and no project.
 *
 * Creating criteria writes version 1 and starts a run. Editing writes a new
 * version and starts a new run; a run that already started keeps the exact
 * version it used (§4.1).
 */

const criteriaFields = (input: ParsedFinanceCriteriaInput) => ({
  preset: input.preset,
  words: input.words,
  companySize: input.companySize,
  industries: input.industries,
  leaveOut: input.leaveOut,
  howManyStocks: input.howManyStocks,
});

const latestVersionSelect = {
  orderBy: { version: "desc" as const },
  take: 1,
  select: { id: true, version: true, createdAt: true },
};

const criteriaListSelect = {
  id: true,
  preset: true,
  words: true,
  companySize: true,
  industries: true,
  leaveOut: true,
  howManyStocks: true,
  createdAt: true,
  updatedAt: true,
  versions: latestVersionSelect,
  runs: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      stage: true,
      createdAt: true,
      _count: { select: { candidates: true } },
    },
  },
  _count: { select: { versions: true, runs: true } },
} satisfies Prisma.FinanceCriteriaSelect;

type CriteriaListRow = Prisma.FinanceCriteriaGetPayload<{
  select: typeof criteriaListSelect;
}>;

export type FinanceCriteriaView = {
  id: string;
  preset: CriteriaListRow["preset"];
  words: string;
  companySize: CriteriaListRow["companySize"];
  industries: string[];
  leaveOut: string[];
  howManyStocks: number;
  createdAt: Date;
  updatedAt: Date;
  latestVersion: number;
  versionCount: number;
  runCount: number;
  latestRun: {
    id: string;
    stage: CriteriaListRow["runs"][number]["stage"];
    createdAt: Date;
    candidateCount: number;
  } | null;
};

function toCriteriaView(row: CriteriaListRow): FinanceCriteriaView {
  const latest = row.versions[0] ?? null;
  const run = row.runs[0] ?? null;
  return {
    id: row.id,
    preset: row.preset,
    words: row.words,
    companySize: row.companySize,
    industries: row.industries,
    leaveOut: row.leaveOut,
    howManyStocks: row.howManyStocks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestVersion: latest?.version ?? 1,
    versionCount: row._count.versions,
    runCount: row._count.runs,
    latestRun: run
      ? {
          id: run.id,
          stage: run.stage,
          createdAt: run.createdAt,
          candidateCount: run._count.candidates,
        }
      : null,
  };
}

/** The owner's criteria, newest first, each with its latest version and run. */
export async function listFinanceCriteria(
  ownerId: string,
): Promise<FinanceCriteriaView[]> {
  const rows = await prisma.financeCriteria.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: criteriaListSelect,
  });
  return rows.map(toCriteriaView);
}

/** One criteria row, scoped to the owner. Null when it is not theirs. */
export async function getFinanceCriteria(
  ownerId: string,
  criteriaId: string,
): Promise<FinanceCriteriaView | null> {
  const row = await prisma.financeCriteria.findFirst({
    where: { id: criteriaId, ownerId },
    select: criteriaListSelect,
  });
  return row ? toCriteriaView(row) : null;
}

/** Create criteria, its first immutable version, and the run that starts it. */
export async function createFinanceCriteria(
  ownerId: string,
  input: ParsedFinanceCriteriaInput,
): Promise<FinanceCriteriaView> {
  const fields = criteriaFields(input);
  const criteria = await prisma.$transaction(async (tx) => {
    const created = await tx.financeCriteria.create({
      data: { ownerId, ...fields },
      select: { id: true },
    });
    const version = await tx.financeCriteriaVersion.create({
      data: { criteriaId: created.id, version: 1, ...fields },
      select: { id: true },
    });
    await tx.financeRun.create({
      data: {
        ownerId,
        criteriaId: created.id,
        criteriaVersionId: version.id,
        stage: "screen",
      },
      select: { id: true },
    });
    return created;
  });

  const view = await getFinanceCriteria(ownerId, criteria.id);
  if (!view) throw new Error("Finance criteria disappeared after creation.");
  return view;
}

/**
 * Edit criteria: a new version and a new run. The previous version and every
 * run that used it are left exactly as they were.
 */
export async function updateFinanceCriteria(
  ownerId: string,
  criteriaId: string,
  input: ParsedFinanceCriteriaInput,
): Promise<FinanceCriteriaView | null> {
  const existing = await prisma.financeCriteria.findFirst({
    where: { id: criteriaId, ownerId },
    select: { id: true },
  });
  if (!existing) return null;

  const fields = criteriaFields(input);
  await prisma.$transaction(async (tx) => {
    await tx.financeCriteria.update({
      where: { id: existing.id },
      data: fields,
      select: { id: true },
    });
    const latest = await tx.financeCriteriaVersion.findFirst({
      where: { criteriaId: existing.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = await tx.financeCriteriaVersion.create({
      data: {
        criteriaId: existing.id,
        version: (latest?.version ?? 0) + 1,
        ...fields,
      },
      select: { id: true },
    });
    await tx.financeRun.create({
      data: {
        ownerId,
        criteriaId: existing.id,
        criteriaVersionId: version.id,
        stage: "screen",
      },
      select: { id: true },
    });
  });

  return getFinanceCriteria(ownerId, criteriaId);
}

/** Delete criteria, its versions and its runs. Only the owner may. */
export async function deleteFinanceCriteria(
  ownerId: string,
  criteriaId: string,
): Promise<boolean> {
  const result = await prisma.financeCriteria.deleteMany({
    where: { id: criteriaId, ownerId },
  });
  return result.count > 0;
}

/** Every version of one criteria row, newest first, scoped to the owner. */
export async function listFinanceCriteriaVersions(
  ownerId: string,
  criteriaId: string,
) {
  const criteria = await prisma.financeCriteria.findFirst({
    where: { id: criteriaId, ownerId },
    select: { id: true },
  });
  if (!criteria) return null;

  const versions = await prisma.financeCriteriaVersion.findMany({
    where: { criteriaId: criteria.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      preset: true,
      words: true,
      companySize: true,
      industries: true,
      leaveOut: true,
      howManyStocks: true,
      createdAt: true,
      _count: { select: { runs: true } },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    version: version.version,
    preset: version.preset,
    words: version.words,
    companySize: version.companySize,
    industries: version.industries,
    leaveOut: version.leaveOut,
    howManyStocks: version.howManyStocks,
    createdAt: version.createdAt,
    runCount: version._count.runs,
  }));
}
