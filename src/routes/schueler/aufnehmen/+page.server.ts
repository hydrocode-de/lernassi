import { db } from "$lib/server/db";
import {
  consents,
  notes,
  tocEntries,
  uploadPages,
  uploads,
} from "$lib/server/db/schema";
import { KeinSchluessel, leseAufschrieb, tocAlsText } from "$lib/server/ingest";
import { darfSpeichern, fingerabdruck, legeSeiteAb } from "$lib/server/bilder";
import { einsortieren, kapitelMitFach } from "$lib/server/gliederung";
import {
  fachEintrag,
  klasseFuerFach,
  meineKlasse,
  meineKlassen,
} from "$lib/server/klasse";
import { themenReihenfolge } from "$lib/server/heft";
import { fotoQuelle, quellenSchreiben } from "$lib/server/quelle";
import { and, eq, inArray } from "drizzle-orm";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

/** Nur Wege innerhalb der Anwendung — siehe aufnahme/[id]. */
function saubererWeiterWeg(roh: string | null): string | null {
  return roh && /^\/schueler\/kapitel\/[\w-]+$/.test(roh) ? roh : null;
}

/**
 * Kam das Kind aus dem Verzeichnis, hat es Kapitel und Stelle schon selbst gewählt. Dann ist
 * hier nichts mehr zu entscheiden: das Fach steht über dem Kapitel, und die neuen Themen
 * landen genau an der Stelle, auf die das Kind getippt hat. Der KI bleibt das Teilen in
 * Themen — die Einordnung hat das Kind gemacht.
 */
async function festesZiel(
  studentId: string,
  kapitelId: string | null,
  stelle: string | null,
) {
  if (!kapitelId) return null;
  const treffer = await kapitelMitFach(studentId, kapitelId);
  if (!treffer) return null;
  const themen = await themenReihenfolge(studentId, treffer.kapitel.id);
  return {
    kapitelId: treffer.kapitel.id,
    kapitel: treffer.kapitel.title,
    fachId: treffer.fach.id,
    fach: treffer.fach.title,
    // Die Stelle darf nur ein Thema DIESES Kapitels sein — sonst ans Ende.
    stelle:
      stelle === "anfang" || themen.some((t) => t.id === stelle) ? stelle : "",
    davor: themen.find((t) => t.id === stelle)?.title ?? null,
  };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user || locals.user.role !== "student")
    throw redirect(303, "/anmelden");
  return {
    // Zur Wahl stehen die Klassen des Kindes, nicht die Fächer seines Hefts: ein Fach IST eine
    // Klasse. Vorher konnte hier ein Name getippt werden, der zu keiner Klasse passte — dann
    // lief die Runde ohne Lernziel und mit der Skala einer fremden Klasse.
    klassen: await meineKlassen(locals.user.id),
    weiter: saubererWeiterWeg(url.searchParams.get("weiter")),
    ziel: await festesZiel(
      locals.user.id,
      url.searchParams.get("kapitel"),
      url.searchParams.get("nach"),
    ),
  };
};

/** Legt einen Gliederungseintrag an, wenn es ihn unter diesem Elternteil noch nicht gibt. */
async function findeOderLege(
  studentId: string,
  kind: "subject" | "chapter" | "topic",
  title: string,
  parentId: string | null,
): Promise<string> {
  const vorhanden = (
    await db
      .select()
      .from(tocEntries)
      .where(
        and(eq(tocEntries.studentId, studentId), eq(tocEntries.kind, kind)),
      )
  ).find(
    (e) =>
      e.parentId === parentId &&
      e.title.localeCompare(title, "de", { sensitivity: "base" }) === 0,
  );
  if (vorhanden) return vorhanden.id;
  const [neu] = await db
    .insert(tocEntries)
    .values({ studentId, kind, title, parentId })
    .returning({ id: tocEntries.id });
  return neu.id;
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== "student")
      throw redirect(303, "/anmelden");
    const studentId = locals.user.id;

    const fd = await request.formData();
    // Mit festem Ziel gilt die Klasse des Kapitels, nicht die aus dem Auswahlfeld — das ist
    // dann gar nicht sichtbar.
    const ziel = await festesZiel(
      studentId,
      String(fd.get("kapitel") ?? "") || null,
      String(fd.get("nach") ?? "") || null,
    );
    const klasse = ziel
      ? await klasseFuerFach(studentId, ziel.fachId)
      : await meineKlasse(studentId, String(fd.get("klasse") ?? ""));
    const fach = klasse?.fach ?? ziel?.fach ?? "";
    const dateien = fd
      .getAll("seiten")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (!fach)
      return fail(400, {
        doppelt: false,
        message: "Wähle zuerst, um welches Fach es geht.",
      });
    if (!dateien.length)
      return fail(400, {
        doppelt: false,
        message: "Nimm mindestens eine Seite auf.",
      });

    const bilder = await Promise.all(
      dateien.map(async (d) => {
        const daten = new Uint8Array(await d.arrayBuffer());
        return {
          daten,
          mimeType: d.type || "image/jpeg",
          hash: fingerabdruck(daten),
        };
      }),
    );

    // Dieselbe Heftseite ein zweites Mal lesen zu lassen kostet Geld und erzeugt
    // Doppelgänger im Verzeichnis. Also nachfragen statt einfach machen.
    if (fd.get("trotzdem") !== "1") {
      const schonDa = await db
        .select({ hash: uploadPages.imageHash, wann: uploads.createdAt })
        .from(uploadPages)
        .innerJoin(uploads, eq(uploads.id, uploadPages.uploadId))
        .where(
          and(
            eq(uploads.studentId, studentId),
            inArray(
              uploadPages.imageHash,
              bilder.map((b) => b.hash),
            ),
          ),
        );
      if (schonDa.length) {
        const nummern = bilder
          .map((b, i) =>
            schonDa.some((s) => s.hash === b.hash) ? i + 1 : null,
          )
          .filter((n): n is number => n !== null);
        const wann = schonDa[0].wann.toLocaleDateString("de-DE", {
          day: "numeric",
          month: "long",
        });
        return fail(409, {
          doppelt: true,
          message:
            nummern.length === bilder.length
              ? `Diese Seite hast du am ${wann} schon einmal fotografiert.`
              : `Seite ${nummern.join(" und ")} hast du am ${wann} schon einmal fotografiert.`,
        });
      }
    }

    // Bisherige Gliederung dieses Fachs — damit eingeordnet statt erfunden wird.
    const alle = await db
      .select()
      .from(tocEntries)
      .where(eq(tocEntries.studentId, studentId));
    // Über die Klasse, nicht über den Namen. Der Namensvergleich bleibt nur als Rückfall für
    // Altdaten-Fächer ohne Klasse.
    const fachZeile = alle.find((e) =>
      e.kind !== "subject"
        ? false
        : klasse
          ? e.classId === klasse.id
          : e.title.localeCompare(fach, "de", { sensitivity: "base" }) === 0,
    );
    const gliederung = tocAlsText(
      alle
        .filter((e) => e.kind === "chapter" && e.parentId === fachZeile?.id)
        .map((k) => ({
          title: k.title,
          themen: alle
            .filter((t) => t.kind === "topic" && t.parentId === k.id)
            .map((t) => t.title),
        })),
    );

    let ergebnis;
    try {
      ergebnis = await leseAufschrieb({
        bilder,
        fach,
        gliederung,
        festesKapitel: ziel?.kapitel,
      });
    } catch (e) {
      if (e instanceof KeinSchluessel)
        return fail(503, {
          doppelt: false,
          message:
            "Das Lesen ist gerade nicht möglich. Versuch es später nochmal.",
        });
      // Ursache bleibt im Server-Log, das Kind bekommt einen ruhigen Satz.
      console.error("[ingest] Lesen fehlgeschlagen:", e);
      const body = (e as { responseBody?: unknown }).responseBody;
      if (body) console.error("[ingest] Antwort:", String(body).slice(0, 800));
      return fail(502, {
        doppelt: false,
        message: "Ich konnte die Seiten nicht lesen. Versuch es nochmal.",
      });
    }

    if (!ergebnis.lesbar || ergebnis.abschnitte.length === 0) {
      return fail(422, {
        doppelt: false,
        message:
          ergebnis.hinweis ||
          "Ich konnte die Seiten nicht gut lesen. Fotografiere sie noch einmal, mit mehr Licht.",
      });
    }

    // Fotosession anlegen, danach die gefundenen Themen daran hängen.
    const [upload] = await db
      .insert(uploads)
      .values({ studentId, subject: fach, pageCount: bilder.length })
      .returning({ id: uploads.id });

    const einwilligung = (
      await db.select().from(consents).where(eq(consents.studentId, studentId))
    )[0];
    const behalten = einwilligung?.keepOwnImages ?? false;

    for (const [i, bild] of bilder.entries()) {
      const ref = darfSpeichern(behalten)
        ? await legeSeiteAb(upload.id, i + 1, bild.daten, bild.mimeType)
        : null;
      await db
        .insert(uploadPages)
        .values({
          uploadId: upload.id,
          pageNumber: i + 1,
          imageRef: ref,
          imageHash: bild.hash,
        });
    }

    // Der Fach-Zweig gehört zur Klasse, nicht zu einem Namen. Ohne Klasse (nur bei Altdaten
    // erreichbar, wenn das feste Ziel an einem klassenlosen Fach hängt) bleibt es beim Titel.
    const fachId = klasse
      ? await fachEintrag(studentId, klasse)
      : await findeOderLege(studentId, "subject", fach, null);
    const neueThemen: string[] = [];
    for (const [i, abschnitt] of ergebnis.abschnitte.entries()) {
      const kapitelId =
        ziel?.kapitelId ??
        (await findeOderLege(studentId, "chapter", abschnitt.kapitel, fachId));
      const themaId = await findeOderLege(
        studentId,
        "topic",
        abschnitt.thema,
        kapitelId,
      );
      neueThemen.push(themaId);
      const [note] = await db
        .insert(notes)
        .values({
          studentId,
          uploadId: upload.id,
          topicId: themaId,
          transcript: abschnitt.transkript,
          summary: abschnitt.zusammenfassung,
          keywords: abschnitt.begriffe.join(", "),
          pageNumbers: abschnitt.seiten.join(","),
          sortOrder: i,
        })
        .returning({ id: notes.id });
      await quellenSchreiben(note.id, [
        fotoQuelle(abschnitt.seiten, new Date()),
      ]);
    }

    // Nur mit festem Ziel: dann hat das Kind eine Stelle gewählt, und die gilt. Ohne Ziel
    // bleibt es bei der bisherigen Regel — neues Material steht oben.
    if (ziel)
      await einsortieren(studentId, ziel.kapitelId, neueThemen, ziel.stelle);

    const weiter = saubererWeiterWeg(String(fd.get("weiter") ?? "") || null);
    throw redirect(
      303,
      `/schueler/aufnahme/${upload.id}${weiter ? `?weiter=${encodeURIComponent(weiter)}` : ""}`,
    );
  },
};
