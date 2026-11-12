import { openDatabaseSync } from "expo-sqlite";
import type { StepRow, TrackingStore } from "./local-store";
import type { TrackPoint } from "./track";

// On-device buffer for GPS fixes and steps (a SQLite file in the app's private storage). Rows are
// removed when the workout is cleared; anything older than two days is purged at startup.

type PointRow = { t: number; lat: number; lng: number; acc: number | null; alt: number | null; spd: number | null; mock: number };

const toPoint = (r: PointRow): TrackPoint => ({ t: r.t, lat: r.lat, lng: r.lng, acc: r.acc, alt: r.alt, spd: r.spd, mock: r.mock === 1 });
const COLUMNS = "t, lat, lng, acc, alt, spd, mock";

export function createSqliteStore(): TrackingStore {
  const db = openDatabaseSync("squadsix-tracking.db");
  db.execSync(`
    create table if not exists points (
      session text not null, t integer not null, lat real not null, lng real not null,
      acc real, alt real, spd real, mock integer not null, sent integer not null default 0,
      primary key (session, t)
    ) without rowid;
    create table if not exists steps (
      session text not null, minute integer not null, steps integer not null, sent_steps integer not null default 0,
      primary key (session, minute)
    ) without rowid;
  `);

  return {
    addPoints(session, points) {
      if (points.length === 0) return;
      db.withTransactionSync(() => {
        for (const p of points) {
          db.runSync(
            `insert or ignore into points (session, ${COLUMNS}) values (?, ?, ?, ?, ?, ?, ?, ?)`,
            session, p.t, p.lat, p.lng, p.acc, p.alt, p.spd, p.mock ? 1 : 0,
          );
        }
      });
    },
    allPoints: (session) =>
      db.getAllSync<PointRow>(`select ${COLUMNS} from points where session = ? order by t`, session).map(toPoint),
    unsentPoints: (session, limit) =>
      db.getAllSync<PointRow>(`select ${COLUMNS} from points where session = ? and sent = 0 order by t limit ?`, session, limit).map(toPoint),
    markPointsSent(session, times) {
      db.withTransactionSync(() => {
        for (const t of times) db.runSync("update points set sent = 1 where session = ? and t = ?", session, t);
      });
    },
    addSteps(session, minute, steps) {
      db.runSync(
        `insert into steps (session, minute, steps) values (?, ?, ?)
         on conflict (session, minute) do update set steps = steps + excluded.steps`,
        session, minute, steps,
      );
    },
    stepRows: (session) =>
      db.getAllSync<StepRow>("select minute, steps, sent_steps as sentSteps from steps where session = ? order by minute", session),
    markStepsSent(session, rows) {
      db.withTransactionSync(() => {
        for (const r of rows) {
          db.runSync("update steps set sent_steps = max(sent_steps, ?) where session = ? and minute = ?", r.steps, session, r.minute);
        }
      });
    },
    clear(session) {
      db.runSync("delete from points where session = ?", session);
      db.runSync("delete from steps where session = ?", session);
    },
    purgeOlderThan(t) {
      db.runSync("delete from points where t < ?", t);
      db.runSync("delete from steps where minute < ?", t);
    },
  };
}
