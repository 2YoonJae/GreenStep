/**
 * 목업 DB — 백엔드(PostgreSQL)를 만들지 않는 동안 브라우저 localStorage 에 테이블을 흉내 냅니다.
 * 이 파일은 src/api/mock 안에서만 import 합니다. 화면 코드에서 직접 사용하지 마세요.
 */
import type { Activity, Application, CsrReport, Faq, Notice, OrgKey, OrgMember, Organization, Participation, ResumeDoc, Role, User } from '../../data/types';
import * as seed from '../../data/seed';

// v4: 명칭 변경(봉사 이력서 · ESG 경영 보고서)·채용/사진 제거 반영 — 이전 저장분은 새로 생성
const DB_KEY = 'greenstep-demo-v4';
const SESSION_KEY = 'greenstep-session-v1';

interface Credential {
  subjectType: Role;
  subjectId: string; // users.id 또는 org_members.id
  email: string;
  passwordHash: string; // 목업: SHA-256 / 실서버: argon2
}

export interface MockDb {
  users: User[];
  organizations: Organization[];
  org_members: OrgMember[];
  /** organization_keys — 발급한 기관 코드 키. 예전 저장분에는 없을 수 있음 */
  org_keys?: OrgKey[];
  credentials: Credential[];
  activities: Activity[];
  applications: Application[];
  participations: Participation[];
  resumes: { userId: string; doc: ResumeDoc }[];
  csr_reports: CsrReport[];
  notices: Notice[];
  faqs: Faq[];
  seq: number;
}

export interface MockSession {
  role: Role;
  subjectId: string;
  token: string;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createSeedDb(): Promise<MockDb> {
  const hash = await sha256(seed.DEMO_PASSWORD);
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    users: clone(seed.seedUsers),
    organizations: clone(seed.seedOrgs),
    org_members: clone(seed.seedMembers),
    org_keys: clone(seed.seedOrgKeys),
    credentials: [
      ...seed.seedUsers.map((u) => ({ subjectType: 'YOUTH' as const, subjectId: u.id, email: u.email, passwordHash: hash })),
      ...seed.seedMembers.map((m) => ({ subjectType: 'ORG' as const, subjectId: m.id, email: m.email, passwordHash: hash })),
    ],
    activities: clone(seed.seedActivities),
    applications: [...clone(seed.seedApplications), { id: 'ap3', activityId: 'c3', userId: 'u1', status: 'APPLIED', createdAt: '2026-10-28T10:00:00.000Z' }],
    participations: clone(seed.seedParticipations),
    resumes: [],
    csr_reports: clone(seed.seedReports),
    notices: clone(seed.seedNotices),
    faqs: clone(seed.seedFaqs),
    seq: 100,
  };
}

let cache: MockDb | null = null;

export async function db(): Promise<MockDb> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      cache = JSON.parse(raw) as MockDb;
      return cache;
    }
  } catch {
    /* 손상되었거나 접근 불가 → 새로 생성 */
  }
  cache = await createSeedDb();
  save();
  return cache;
}

export function save() {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 불가(시크릿 모드 등) — 메모리에서만 유지 */
  }
}

export function nextId(d: MockDb, prefix: string): string {
  d.seq += 1;
  return `${prefix}${d.seq}`;
}

export async function resetDb() {
  cache = await createSeedDb();
  save();
  setSession(null);
}

export function getSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: MockSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 무시 */
  }
}
