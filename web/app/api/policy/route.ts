import { NextRequest, NextResponse } from "next/server";
import { query, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CriteriaRow {
  sub_family_id: string;
  sub_family_name: string;
  family_id: string;
  family_name: string;
  level: number;
  expertise_criteria: string;
  impact_criteria: string;
}

interface FamilyRow {
  family_id: string;
  family_name: string;
  description: string | null;
}

interface SubFamilyRow {
  sub_family_id: string;
  sub_family_name: string;
  description: string | null;
  family_id: string;
  family_name: string;
}

function loadPayload() {
  const rows = query<CriteriaRow>(
    `SELECT lc.sub_family_id, sf.sub_family_name, sf.family_id, f.family_name, lc.level,
            lc.expertise_criteria, lc.impact_criteria
     FROM level_criteria lc
     JOIN sub_skill_family sf ON lc.sub_family_id = sf.sub_family_id
     JOIN skill_family f ON sf.family_id = f.family_id
     ORDER BY f.family_id, lc.sub_family_id, lc.level`
  );

  const families = query<FamilyRow>(
    `SELECT family_id, family_name, description
     FROM skill_family
     ORDER BY family_id`
  );

  const subFamilies = query<SubFamilyRow>(
    `SELECT sf.sub_family_id, sf.sub_family_name, sf.description, sf.family_id, f.family_name
     FROM sub_skill_family sf
     JOIN skill_family f ON sf.family_id = f.family_id
     ORDER BY sf.family_id, sf.sub_family_id`
  );

  return { rows, families, subFamilies };
}

export async function GET() {
  return NextResponse.json(loadPayload());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as
    | {
        action: "save";
        updates?: {
          sub_family_id: string;
          level: number;
          expertise_criteria: string;
          impact_criteria: string;
        }[];
        family_updates?: {
          family_id: string;
          family_name: string;
          description: string;
        }[];
        sub_family_updates?: {
          sub_family_id: string;
          sub_family_name: string;
          description: string;
          family_id: string;
        }[];
      }
    | {
        action: "create_family";
        family_id: string;
        family_name: string;
        description?: string;
      }
    | {
        action: "delete_family";
        family_id: string;
      }
    | {
        action: "create_sub_family";
        sub_family_id: string;
        sub_family_name: string;
        family_id: string;
        description?: string;
      }
    | {
        action: "delete_sub_family";
        sub_family_id: string;
      };

  try {
    if (body.action === "save") {
      tx(() => {
        for (const update of body.updates ?? []) {
          run(
            `UPDATE level_criteria
             SET expertise_criteria = ?, impact_criteria = ?
             WHERE sub_family_id = ? AND level = ?`,
            [
              update.expertise_criteria,
              update.impact_criteria,
              update.sub_family_id,
              update.level,
            ]
          );
        }

        for (const family of body.family_updates ?? []) {
          run(
            `UPDATE skill_family
             SET family_name = ?, description = ?
             WHERE family_id = ?`,
            [family.family_name.trim(), family.description?.trim() || "", family.family_id]
          );
        }

        for (const subFamily of body.sub_family_updates ?? []) {
          run(
            `UPDATE sub_skill_family
             SET sub_family_name = ?, description = ?, family_id = ?
             WHERE sub_family_id = ?`,
            [
              subFamily.sub_family_name.trim(),
              subFamily.description?.trim() || "",
              subFamily.family_id,
              subFamily.sub_family_id,
            ]
          );
        }
      });

      return NextResponse.json({ ok: true, saved: true, ...loadPayload() });
    }

    if (body.action === "create_family") {
      if (!body.family_id.trim() || !body.family_name.trim()) {
        return NextResponse.json({ error: "family_id and family_name are required" }, { status: 400 });
      }
      run(`INSERT INTO skill_family (family_id, family_name, description) VALUES (?, ?, ?)`, [
        body.family_id.trim().toUpperCase(),
        body.family_name.trim(),
        body.description?.trim() || "",
      ]);
      return NextResponse.json({ ok: true, ...loadPayload() });
    }

    if (body.action === "delete_family") {
      const ref = query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sub_skill_family WHERE family_id = ?`,
        [body.family_id]
      )[0]?.count ?? 0;
      if (ref > 0) {
        return NextResponse.json(
          { error: `Cannot delete family. ${ref} sub-family rows still reference it.` },
          { status: 400 }
        );
      }
      run(`DELETE FROM skill_family WHERE family_id = ?`, [body.family_id]);
      return NextResponse.json({ ok: true, ...loadPayload() });
    }

    if (body.action === "create_sub_family") {
      if (!body.sub_family_id.trim() || !body.sub_family_name.trim() || !body.family_id.trim()) {
        return NextResponse.json(
          { error: "sub_family_id, sub_family_name, and family_id are required" },
          { status: 400 }
        );
      }

      tx(() => {
        run(
          `INSERT INTO sub_skill_family (sub_family_id, family_id, sub_family_name, description)
           VALUES (?, ?, ?, ?)`,
          [
            body.sub_family_id.trim().toUpperCase(),
            body.family_id,
            body.sub_family_name.trim(),
            body.description?.trim() || "",
          ]
        );

        for (const level of [1, 2, 3, 4]) {
          run(
            `INSERT INTO level_criteria (sub_family_id, level, expertise_criteria, impact_criteria)
             VALUES (?, ?, '', '')`,
            [body.sub_family_id.trim().toUpperCase(), level]
          );
        }
      });

      return NextResponse.json({ ok: true, ...loadPayload() });
    }

    if (body.action === "delete_sub_family") {
      const ref = query<{ count: number }>(
        `SELECT COUNT(*) as count FROM skill WHERE sub_family_id = ?`,
        [body.sub_family_id]
      )[0]?.count ?? 0;
      if (ref > 0) {
        return NextResponse.json(
          { error: `Cannot delete sub-family. ${ref} skills still reference it.` },
          { status: 400 }
        );
      }

      tx(() => {
        run(`DELETE FROM level_criteria WHERE sub_family_id = ?`, [body.sub_family_id]);
        run(`DELETE FROM sub_skill_family WHERE sub_family_id = ?`, [body.sub_family_id]);
      });

      return NextResponse.json({ ok: true, ...loadPayload() });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update policy data" },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
