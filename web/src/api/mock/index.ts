/**
 * 목업 API — FastAPI 서버가 할 일을 브라우저에서 흉내 냅니다.
 * 서버 권한 검사(역할, 자기 기관 데이터만, 심사 승인 여부)도 여기서 똑같이 수행합니다.
 * 백엔드가 준비되면 VITE_API_MODE=http 로 바꾸기만 하면 화면 코드는 그대로입니다.
 */
import type { Api, ActivityDetail } from '../types';
import {
  ApiError,
  REGION_CODE,
  REGIONS,
  type Activity,
  type ActivityInput,
  type CsrReport,
  type Organization,
  type Page,
  type Participation,
  type ResumeDoc,
  type Session,
  type User,
} from '../../data/types';
import { db, getSession, nextId, save, setSession, sha256, type MockDb } from './db';
import { judgeDifficulty } from '../../lib/difficulty';
import { hoursBetween, rateOf, socialValue } from '../../lib/sroi';
import { approvalRate, buildSnapshot, sumHours, sumValue, uniqueYouth } from '../../lib/aggregate';
import { daysUntil, maskName, today } from '../../lib/format';

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const fail = (status: number, msg: string): never => {
  throw new ApiError(status, msg);
};
const token = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand4 = () => Array.from({ length: 4 }, () => ALNUM[Math.floor(Math.random() * ALNUM.length)]).join('');

function paginate<T>(rows: T[], page = 1, pageSize = 12): Page<T> {
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
}

/* ───────── 인증 · 권한 (서버 검사 흉내) ───────── */

function sessionOf(d: MockDb, role: 'YOUTH' | 'ORG', subjectId: string, tok: string): Session {
  if (role === 'YOUTH') {
    const user = d.users.find((u) => u.id === subjectId) ?? fail(401, '계정을 찾을 수 없습니다.');
    return { role, accessToken: tok, user };
  }
  const member = d.org_members.find((m) => m.id === subjectId) ?? fail(401, '계정을 찾을 수 없습니다.');
  const org = d.organizations.find((o) => o.id === member.organizationId) ?? fail(401, '기관을 찾을 수 없습니다.');
  return { role, accessToken: tok, member, org };
}

const PW_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const checkPassword = (pw: string) => {
  if (!PW_RULE.test(pw)) fail(400, '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
};
/** users.email 은 UNIQUE — 청년·기관 담당자 모두 같은 users 테이블 */
const emailTaken = (d: MockDb, email: string) => d.users.some((u) => u.email === email) || d.org_members.some((m) => m.email === email);

async function auth() {
  const d = await db();
  const s = getSession() ?? fail(401, '로그인이 필요합니다.');
  return { d, s };
}

async function requireYouth() {
  const { d, s } = await auth();
  if (s.role !== 'YOUTH') fail(403, '청년 회원만 이용할 수 있습니다.');
  const user = d.users.find((u) => u.id === s.subjectId) ?? fail(401, '계정을 찾을 수 없습니다.');
  return { d, user };
}

async function requireOrg(approved = true) {
  const { d, s } = await auth();
  if (s.role !== 'ORG') fail(403, '기관 회원만 이용할 수 있습니다.');
  const member = d.org_members.find((m) => m.id === s.subjectId) ?? fail(401, '계정을 찾을 수 없습니다.');
  const org = d.organizations.find((o) => o.id === member.organizationId) ?? fail(401, '기관을 찾을 수 없습니다.');
  if (approved && org.verificationStatus !== 'APPROVED') fail(403, '운영자 심사가 끝난 뒤 이용할 수 있습니다.');
  return { d, member, org };
}

/** 기관 API는 토큰의 기관 ID와 대상 데이터의 기관 ID가 같을 때만 허용 */
function ownActivity(d: MockDb, org: Organization, id: string): Activity {
  const a = d.activities.find((x) => x.id === id) ?? fail(404, '활동을 찾을 수 없습니다.');
  if (a.organizationId !== org.id) fail(403, '다른 기관의 활동입니다.');
  return a;
}

/* ───────── 활동 ───────── */

/** 서버(backend/app/routers/org.py)와 같은 검사 */
function validateActivity(i: ActivityInput) {
  const d = i.details;
  if (!i.title.trim()) fail(400, '활동명을 입력해 주세요.');
  if (!REGIONS.some((r) => REGION_CODE[r] === i.regionCode)) fail(400, '시·도를 선택해 주세요.');
  if (!i.regionName.trim()) fail(400, '지역명을 입력해 주세요.');
  if (!i.recruitStartDate || !i.recruitEndDate || i.recruitStartDate > i.recruitEndDate) fail(400, '모집 시작일은 모집 마감일 이전이어야 합니다.');
  if (!i.activityStartDate || !i.activityEndDate || i.activityStartDate > i.activityEndDate) fail(400, '활동 기간을 확인해 주세요.');
  if (i.recruitEndDate > i.activityEndDate) fail(400, '모집 마감일은 활동 종료일 이전이어야 합니다.');
  if (!(i.capacity >= 1 && i.capacity <= 500)) fail(400, '모집 정원은 1~500명입니다.');
  if (!(d.hoursPerSession >= 0.5 && d.hoursPerSession <= 12)) fail(400, '회당 활동 시간은 0.5~12시간입니다.');
  if (!d.targetGroup.trim() || !d.tasks.trim()) fail(400, '대상자와 수행 업무를 입력해 주세요.');
}

/** activities 컬럼 + activity_details 컬럼을 한 행으로 */
function activityFields(i: ActivityInput) {
  const { details, ...rest } = i;
  return {
    ...rest,
    title: i.title.trim(),
    regionName: i.regionName.trim(),
    summary: details.summary.trim(),
    hoursPerSession: details.hoursPerSession,
    targetGroup: details.targetGroup.trim(),
    tasks: details.tasks.trim(),
    individualSupport: details.individualSupport,
  };
}

/** 가중치는 서버가 결정. 기관 입력으로는 후보만 표시, 운영자 확인 전 1.0 */
function applyDifficulty(a: Activity) {
  const r = judgeDifficulty(a);
  a.difficultyReason = r.reason;
  if (a.weightStatus === 'CONFIRMED' && r.candidate) return; // 운영자 확정 유지
  a.weightStatus = r.candidate ? 'CANDIDATE' : 'NONE';
  a.weightFlags = { ...a.weightFlags, difficulty: false };
  a.weight = 1;
}

const isOpen = (a: Activity) => a.status === 'RECRUITING' && daysUntil(a.recruitEndDate) >= 0;
const expected = (a: Activity) => socialValue(a.hoursPerSession, rateOf(a.category), a.weight);

/* ───────── 보고서 ───────── */

function confirmNo(year: number, orgId: string) {
  const seq = orgId.replace(/\D/g, '').padStart(4, '0').slice(-4);
  return `GS-${year}-${seq}-${rand4()}`;
}

function ownReport(d: MockDb, org: Organization, id: string): CsrReport {
  const r = d.csr_reports.find((x) => x.id === id) ?? fail(404, '보고서를 찾을 수 없습니다.');
  if (r.orgId !== org.id) fail(403, '다른 기관의 보고서입니다.');
  return r;
}

const AI_TEMPLATES = {
  greeting: [
    (org: string, memo: string) =>
      `안녕하십니까. ${org}입니다.\n{연도} 한 해 동안 지역 청년 {참여청년}이 저희 기관과 함께 {총시간}의 봉사활동에 참여해 주셨습니다. 이를 사회적 가치로 환산하면 {총가치}에 이릅니다.${memo ? `\n${memo}` : ''}\n함께해 주신 청년 봉사자와 후원자 여러분께 깊이 감사드립니다.`,
    (org: string, memo: string) =>
      `${org}를 아끼고 응원해 주시는 모든 분께 감사 인사를 드립니다.\n{연도}에는 {참여청년}의 청년이 {총시간} 동안 이웃 곁을 지켰고, 그 시간은 {총가치}의 사회적 가치로 남았습니다.${memo ? ` ${memo}` : ''}\n앞으로도 지역과 함께 성장하는 기관이 되겠습니다.`,
    (org: string, memo: string) =>
      `{연도} ESG 경영 보고서를 펴내며 인사드립니다.\n${org}의 활동은 청년 봉사자 {참여청년}의 참여로 완성되었습니다. 누적 {총시간}, 사회적 가치 {총가치}라는 결과는 모두 그분들의 손길 덕분입니다.${memo ? `\n${memo}` : ''}`,
  ],
  intro: [
    (org: string, memo: string, base: string) => `${org}는 ${base}${memo ? `\n${memo}` : ''}\n{연도}에는 GreenStep을 통해 청년 봉사자와 협력하며 활동 기록을 투명하게 관리했습니다.`,
    (org: string, memo: string, base: string) => `${base}\n${org}는 지역 청년의 참여를 기관 운영의 중요한 축으로 삼고 있습니다.${memo ? ` ${memo}` : ''}`,
    (org: string, memo: string, base: string) => `지역과 함께하는 ${org}\n${base}${memo ? `\n주요 내용: ${memo}` : ''}`,
  ],
} as const;

/* ───────── 구현 ───────── */

export const mockApi: Api = {
  mode: 'mock',

  auth: {
    async loginYouth(email, password) {
      await wait();
      const d = await db();
      const c = d.credentials.find((x) => x.subjectType === 'YOUTH' && x.email === email.trim().toLowerCase());
      if (!c || c.passwordHash !== (await sha256(password))) fail(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
      const s = { role: 'YOUTH' as const, subjectId: c!.subjectId, token: token() };
      setSession(s);
      return sessionOf(d, s.role, s.subjectId, s.token);
    },
    async loginOrg(email, password) {
      await wait();
      const d = await db();
      const c = d.credentials.find((x) => x.subjectType === 'ORG' && x.email === email.trim().toLowerCase());
      if (!c || c.passwordHash !== (await sha256(password))) fail(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
      const s = { role: 'ORG' as const, subjectId: c!.subjectId, token: token() };
      setSession(s);
      return sessionOf(d, s.role, s.subjectId, s.token);
    },
    async signupYouth(input) {
      await wait();
      const d = await db();
      checkPassword(input.password);
      const email = input.email.trim().toLowerCase();
      if (emailTaken(d, email)) fail(409, '이미 가입된 이메일입니다.');
      const user: User = {
        id: nextId(d, 'u'), email, name: input.name.trim(), accountStatus: 'ACTIVE', createdAt: now(), updatedAt: now(),
        school: input.profile.school.trim(), targetField: input.profile.targetField, marketingConsent: input.profile.marketingConsent,
      };
      d.users.push(user);
      d.credentials.push({ subjectType: 'YOUTH', subjectId: user.id, email, passwordHash: await sha256(input.password) });
      save();
      const s = { role: 'YOUTH' as const, subjectId: user.id, token: token() };
      setSession(s);
      return sessionOf(d, s.role, s.subjectId, s.token);
    },
    async signupOrg(input) {
      await wait();
      const d = await db();
      const { organization: o, profile, manager } = input;
      checkPassword(manager.password);
      const email = manager.email.trim().toLowerCase();
      const biz = o.businessNo.replace(/\D/g, '');
      if (biz.length !== 10) fail(400, '사업자등록번호 10자리를 입력해 주세요.');
      if (d.organizations.some((x) => x.businessNo === biz)) fail(409, '이미 등록된 사업자등록번호입니다.');
      if (emailTaken(d, email)) fail(409, '이미 가입된 담당자 이메일입니다.');
      const org: Organization = {
        id: nextId(d, 'o'), name: o.name.trim(), organizationType: o.organizationType, verificationStatus: 'PENDING', address: o.address.trim(),
        contactEmail: o.contactEmail.trim().toLowerCase(), createdAt: now(), businessNo: biz,
        intro: profile.intro.trim(), shortage: false, difficulty: false, vulnerable: false,
      };
      const member = {
        id: nextId(d, 'm'), userId: nextId(d, 'mu'), organizationId: org.id, role: 'OWNER' as const, membershipStatus: 'ACTIVE' as const,
        joinedAt: now(), email, name: manager.name.trim(),
      };
      d.organizations.push(org);
      d.org_members.push(member);
      d.credentials.push({ subjectType: 'ORG', subjectId: member.id, email, passwordHash: await sha256(manager.password) });
      save();
      const s = { role: 'ORG' as const, subjectId: member.id, token: token() };
      setSession(s);
      return sessionOf(d, s.role, s.subjectId, s.token);
    },
    async restore() {
      const d = await db();
      const s = getSession();
      if (!s) return null;
      try {
        return sessionOf(d, s.role, s.subjectId, s.token);
      } catch {
        setSession(null);
        return null;
      }
    },
    async logout() {
      await wait(50);
      setSession(null);
    },
  },

  activities: {
    async list(q) {
      await wait();
      const d = await db();
      const kw = (q.q ?? '').trim().toLowerCase();
      let rows = d.activities
        .filter((a) => a.status === 'RECRUITING')
        .filter((a) => !q.region || a.regionCode === REGION_CODE[q.region])
        .filter((a) => !q.category || a.category === q.category)
        .filter((a) => !q.source || a.sourceType === q.source)
        .filter((a) => !q.bonus || a.weightStatus !== 'NONE')
        .filter((a) => q.closingWithinDays === undefined || (daysUntil(a.recruitEndDate) >= 0 && daysUntil(a.recruitEndDate) <= q.closingWithinDays))
        .filter((a) => !kw || `${a.title} ${a.orgName} ${a.summary} ${a.regionName} ${a.tasks}`.replace(/\s+/g, ' ').toLowerCase().includes(kw));
      const openFirst = (a: Activity, b: Activity) => Number(isOpen(b)) - Number(isOpen(a));
      switch (q.sort ?? 'recommended') {
        case 'popular':
          rows = rows.sort((a, b) => openFirst(a, b) || b.views - a.views);
          break;
        case 'deadline':
          rows = rows.filter(isOpen).sort((a, b) => a.recruitEndDate.localeCompare(b.recruitEndDate));
          break;
        case 'value':
          rows = rows.sort((a, b) => openFirst(a, b) || expected(b) - expected(a));
          break;
        case 'latest':
          rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          break;
        default:
          // 추천: 모집 중 우선 → 관심도(조회수) + 가산 조건 활동 보너스
          const score = (a: Activity) => a.views + (a.weightStatus !== 'NONE' ? 30 : 0);
          rows = rows.sort((a, b) => openFirst(a, b) || score(b) - score(a));
      }
      return paginate(rows, q.page, q.pageSize);
    },
    async get(id) {
      await wait(80);
      const d = await db();
      const a = d.activities.find((x) => x.id === id) ?? fail(404, '활동을 찾을 수 없습니다.');
      const s = getSession();
      if (a.status === 'DRAFT') {
        // 임시저장 공고는 작성 기관에게만 노출
        const member = s?.role === 'ORG' ? d.org_members.find((m) => m.id === s.subjectId) : undefined;
        if (!member || member.organizationId !== a.organizationId) fail(404, '활동을 찾을 수 없습니다.');
      }
      a.views += 1;
      save();
      const applied = s?.role === 'YOUTH' && d.applications.some((p) => p.activityId === id && p.userId === s.subjectId && p.status === 'APPLIED');
      return { ...a, applied } as ActivityDetail;
    },
  },

  applications: {
    async mine() {
      await wait();
      const { d, user } = await requireYouth();
      return d.applications
        .filter((p) => p.userId === user.id && p.status === 'APPLIED')
        .map((p) => ({ ...p, activity: d.activities.find((a) => a.id === p.activityId)! }))
        .filter((p) => p.activity)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async apply(activityId) {
      await wait();
      const { d, user } = await requireYouth();
      const a = d.activities.find((x) => x.id === activityId) ?? fail(404, '활동을 찾을 수 없습니다.');
      if (a.sourceType === '1365') fail(400, '1365 공고는 1365 자원봉사포털에서 신청해 주세요.');
      if (!isOpen(a)) fail(400, '모집이 마감된 활동입니다.');
      if (a.applicantCount >= a.capacity) fail(400, '모집 정원이 찼습니다.');
      const exist = d.applications.find((p) => p.activityId === activityId && p.userId === user.id);
      if (exist?.status === 'APPLIED') fail(409, '이미 신청한 활동입니다.');
      if (exist) {
        exist.status = 'APPLIED';
        exist.createdAt = now();
      } else d.applications.push({ id: nextId(d, 'ap'), activityId, userId: user.id, status: 'APPLIED', createdAt: now() });
      a.applicantCount += 1;
      save();
    },
    async cancel(activityId) {
      await wait();
      const { d, user } = await requireYouth();
      const p = d.applications.find((x) => x.activityId === activityId && x.userId === user.id && x.status === 'APPLIED') ?? fail(404, '신청 내역이 없습니다.');
      const a = d.activities.find((x) => x.id === activityId);
      if (a && daysUntil(a.activityStartDate) < 0) fail(400, '이미 시작된 활동은 취소할 수 없습니다.');
      p.status = 'CANCELLED';
      if (a) a.applicantCount = Math.max(0, a.applicantCount - 1);
      save();
    },
  },

  participations: {
    async mine() {
      await wait();
      const { d, user } = await requireYouth();
      return d.participations.filter((p) => p.userId === user.id).sort((a, b) => b.date.localeCompare(a.date));
    },
    async submit(input) {
      await wait();
      const { d, user } = await requireYouth();
      const a = d.activities.find((x) => x.id === input.activityId) ?? fail(404, '활동을 찾을 수 없습니다.');
      if (!d.applications.some((p) => p.activityId === a.id && p.userId === user.id && p.status === 'APPLIED')) fail(403, '신청한 활동만 기록을 제출할 수 있습니다.');
      if (input.date > today()) fail(400, '미래 날짜의 기록은 제출할 수 없습니다.');
      if (input.date < a.activityStartDate || input.date > a.activityEndDate) fail(400, `활동 기간(${a.activityStartDate} ~ ${a.activityEndDate}) 안의 날짜를 선택해 주세요.`);
      const hours = hoursBetween(input.startTime, input.endTime);
      if (hours <= 0 || hours > 12) fail(400, '활동 시간은 0.5~12시간이어야 합니다.');
      if (d.participations.some((p) => p.userId === user.id && p.activityId === a.id && p.date === input.date && p.status !== 'REJECTED')) fail(409, '같은 날짜의 기록이 이미 있습니다.');
      // 제출 시점 스냅샷
      const rate = rateOf(a.category);
      const p: Participation = {
        id: nextId(d, 'p'), userId: user.id, userName: user.name, activityId: a.id, orgId: a.organizationId, activityTitle: a.title, orgName: a.orgName,
        category: a.category, source: 'GREENSTEP', date: input.date, startTime: input.startTime, endTime: input.endTime, hours,
        rateSnapshot: rate, weightSnapshot: a.weight, valueKrw: socialValue(hours, rate, a.weight), status: 'PENDING', note: input.note.trim(),
        certificateName: null, rejectReason: null, submittedAt: now(), reviewedAt: null,
      };
      d.participations.push(p);
      save();
      return p;
    },
    async submitExternal(input) {
      await wait();
      const { d, user } = await requireYouth();
      if (!input.certificate) fail(400, '1365 활동확인서를 첨부해 주세요.');
      if (!input.activityTitle.trim() || !input.orgName.trim()) fail(400, '활동명과 기관명을 입력해 주세요.');
      if (input.date > today()) fail(400, '미래 날짜의 기록은 제출할 수 없습니다.');
      const hours = hoursBetween(input.startTime, input.endTime);
      if (hours <= 0 || hours > 12) fail(400, '활동 시간은 0.5~12시간이어야 합니다.');
      const rate = rateOf(input.category);
      const p: Participation = {
        id: nextId(d, 'p'), userId: user.id, userName: user.name, activityId: null, orgId: null, activityTitle: input.activityTitle.trim(), orgName: input.orgName.trim(),
        category: input.category, source: '1365', date: input.date, startTime: input.startTime, endTime: input.endTime, hours,
        rateSnapshot: rate, weightSnapshot: 1, valueKrw: socialValue(hours, rate, 1), status: 'EXTERNAL_PENDING', note: input.note.trim(),
        // 목업은 파일명만 보관. 실서버는 csr/files 스토리지에 업로드
        certificateName: input.certificate!.name, rejectReason: null, submittedAt: now(), reviewedAt: null,
      };
      d.participations.push(p);
      save();
      return p;
    },
  },

  resume: {
    async latest() {
      await wait(80);
      const { d, user } = await requireYouth();
      const r = d.resumes.filter((x) => x.userId === user.id).at(-1);
      return r?.doc ?? null;
    },
    async issue() {
      await wait();
      const { d, user } = await requireYouth();
      const approved = d.participations.filter((p) => p.userId === user.id && p.status === 'APPROVED').sort((a, b) => a.date.localeCompare(b.date));
      if (approved.length === 0) fail(400, '승인된 활동 기록이 없어 이력서를 발급할 수 없습니다.');
      const doc: ResumeDoc = {
        confirmNo: `GSR-${new Date().getFullYear()}-${user.id.replace(/\D/g, '').padStart(4, '0').slice(-4)}-${rand4()}`,
        issuedAt: now(),
        user: { name: user.name, school: user.school, targetField: user.targetField },
        items: approved.map(({ id, activityTitle, orgName, category, date, hours, weightSnapshot, valueKrw }) => ({ id, activityTitle, orgName, category, date, hours, weightSnapshot, valueKrw })),
        totalHours: sumHours(approved),
        totalValue: sumValue(approved),
      };
      d.resumes.push({ userId: user.id, doc });
      save();
      return doc;
    },
  },

  me: {
    async update(input) {
      await wait();
      const { user } = await requireYouth();
      if (input.name !== undefined) {
        if (!input.name.trim()) fail(400, '이름을 입력해 주세요.');
        user.name = input.name.trim();
      }
      if (input.profile) Object.assign(user, { ...input.profile, school: input.profile.school.trim() });
      user.updatedAt = now();
      save();
      return user;
    },
  },

  org: {
    async me() {
      await wait(60);
      return (await requireOrg(false)).org;
    },
    async dashboard() {
      await wait();
      const { d, org } = await requireOrg();
      const mine = d.participations.filter((p) => p.orgId === org.id);
      return {
        totalValue: sumValue(mine),
        totalHours: sumHours(mine),
        youthCount: uniqueYouth(mine),
        pendingCount: mine.filter((p) => p.status === 'PENDING').length,
        approvalRate: approvalRate(mine),
        activeActivities: d.activities.filter((a) => a.organizationId === org.id && a.status === 'RECRUITING').length,
      };
    },
    async activities() {
      await wait();
      const { d, org } = await requireOrg();
      return d.activities.filter((a) => a.organizationId === org.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async activity(id) {
      await wait(60);
      const { d, org } = await requireOrg();
      return ownActivity(d, org, id);
    },
    async createActivity(input) {
      await wait();
      const { d, org } = await requireOrg();
      validateActivity(input);
      const a: Activity = {
        id: nextId(d, 'a'), organizationId: org.id, sourceType: 'GREENSTEP', externalActivityId: null, externalUrl: null, externalOrgName: null,
        sourceCategory: null, applicantCount: 0, createdAt: now(), updatedAt: now(), orgName: org.name,
        ...activityFields(input),
        difficultyReason: null, weight: 1, weightStatus: 'NONE', weightFlags: { difficulty: false, shortage: false, vulnerable: false }, views: 0,
      };
      applyDifficulty(a);
      d.activities.push(a);
      save();
      return a;
    },
    async updateActivity(id, input) {
      await wait();
      const { d, org } = await requireOrg();
      const a = ownActivity(d, org, id);
      if (a.status === 'CLOSED' || a.status === 'CANCELLED') fail(400, '마감·취소된 활동은 수정할 수 없습니다.');
      validateActivity(input);
      if (input.capacity < a.applicantCount) fail(400, `이미 ${a.applicantCount}명이 신청했습니다. 정원을 그보다 적게 줄일 수 없습니다.`);
      if (input.status === 'DRAFT' && a.status === 'RECRUITING' && a.applicantCount > 0) fail(400, '신청자가 있는 공고는 임시저장으로 내릴 수 없습니다.');
      Object.assign(a, activityFields(input), { updatedAt: now() });
      applyDifficulty(a);
      save();
      return a;
    },
    async setActivityStatus(id, status) {
      await wait();
      const { d, org } = await requireOrg();
      const a = ownActivity(d, org, id);
      if (status === 'DRAFT' && a.applicantCount > 0) fail(400, '신청자가 있는 공고는 임시저장으로 내릴 수 없습니다.');
      a.status = status;
      a.updatedAt = now();
      save();
      return a;
    },
    async deleteActivity(id) {
      await wait();
      const { d, org } = await requireOrg();
      const a = ownActivity(d, org, id);
      if (a.status !== 'DRAFT') fail(400, '임시저장 상태의 활동만 삭제할 수 있습니다. 게시된 활동은 마감 처리해 주세요.');
      d.activities = d.activities.filter((x) => x.id !== id);
      save();
    },
    async participations(status) {
      await wait();
      const { d, org } = await requireOrg();
      return d.participations.filter((p) => p.orgId === org.id && (!status || p.status === status)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    },
    async approve(id) {
      await wait();
      const { d, org } = await requireOrg();
      const p = d.participations.find((x) => x.id === id) ?? fail(404, '기록을 찾을 수 없습니다.');
      if (p.orgId !== org.id) fail(403, '다른 기관의 기록입니다.');
      if (p.status !== 'PENDING') fail(400, '승인 대기 중인 기록만 처리할 수 있습니다.');
      p.status = 'APPROVED';
      p.reviewedAt = now();
      save();
      return p;
    },
    async reject(id, reason) {
      await wait();
      const { d, org } = await requireOrg();
      const p = d.participations.find((x) => x.id === id) ?? fail(404, '기록을 찾을 수 없습니다.');
      if (p.orgId !== org.id) fail(403, '다른 기관의 기록입니다.');
      if (p.status !== 'PENDING') fail(400, '승인 대기 중인 기록만 처리할 수 있습니다.');
      if (!reason.trim()) fail(400, '반려 사유를 입력해 주세요.');
      p.status = 'REJECTED';
      p.rejectReason = reason.trim();
      p.reviewedAt = now();
      save();
      return p;
    },
    async demoApproveReview() {
      await wait();
      const { org } = await requireOrg(false);
      org.verificationStatus = 'APPROVED';
      save();
      return org;
    },
  },

  reports: {
    async summary(year) {
      await wait();
      const { d, org } = await requireOrg();
      return buildSnapshot(org, d.participations, year);
    },
    async list() {
      await wait();
      const { d, org } = await requireOrg();
      return d.csr_reports.filter((r) => r.orgId === org.id).sort((a, b) => b.year - a.year || b.version - a.version);
    },
    async create(year) {
      await wait();
      const { d, org } = await requireOrg();
      if (d.csr_reports.some((r) => r.orgId === org.id && r.year === year && r.status !== 'PUBLISHED')) fail(409, `${year}년 작성 중인 보고서가 이미 있습니다.`);
      const versions = d.csr_reports.filter((r) => r.orgId === org.id && r.year === year).length;
      const r: CsrReport = {
        id: nextId(d, 'r'), orgId: org.id, year, version: versions + 1, theme: 'teal', status: 'DRAFT',
        sections: { greeting: '', intro: org.intro, highlights: '', plan: '' }, aiUsage: { greeting: 0, intro: 0 },
        snapshot: null, confirmNo: null, paidAt: null, publishedAt: null, createdAt: now(), updatedAt: now(),
      };
      d.csr_reports.push(r);
      save();
      return r;
    },
    async update(id, patch) {
      await wait(80);
      const { d, org } = await requireOrg();
      const r = ownReport(d, org, id);
      if (r.status === 'PUBLISHED') fail(400, '발행된 보고서는 수정할 수 없습니다. 새 버전을 만들어 주세요.');
      if (patch.theme) r.theme = patch.theme;
      if (patch.sections) r.sections = { ...r.sections, ...patch.sections };
      r.updatedAt = now();
      save();
      return r;
    },
    async markPaid(id) {
      await wait(300);
      const { d, org } = await requireOrg();
      const r = ownReport(d, org, id);
      if (r.status !== 'DRAFT') fail(400, '이미 결제된 보고서입니다.');
      r.status = 'PAID';
      r.paidAt = now();
      save();
      return r;
    },
    async publish(id) {
      await wait(300);
      const { d, org } = await requireOrg();
      const r = ownReport(d, org, id);
      if (r.status !== 'PAID') fail(400, '결제 후 발행할 수 있습니다.');
      const snap = buildSnapshot(org, d.participations, r.year);
      if (snap.approvedCount === 0) fail(400, `${r.year}년 승인된 활동 기록이 없어 발행할 수 없습니다.`);
      r.snapshot = snap; // 집계 스냅샷 고정
      r.confirmNo = confirmNo(r.year, org.id);
      r.status = 'PUBLISHED';
      r.publishedAt = now();
      save();
      return r;
    },
    async newVersion(id) {
      await wait();
      const { d, org } = await requireOrg();
      const base = ownReport(d, org, id);
      if (base.status !== 'PUBLISHED') fail(400, '발행된 보고서만 새 버전을 만들 수 있습니다.');
      if (d.csr_reports.some((r) => r.orgId === org.id && r.year === base.year && r.status !== 'PUBLISHED')) fail(409, '작성 중인 새 버전이 이미 있습니다.');
      const versions = d.csr_reports.filter((r) => r.orgId === org.id && r.year === base.year).length;
      const r: CsrReport = {
        ...JSON.parse(JSON.stringify(base)), id: nextId(d, 'r'), version: versions + 1, status: 'PAID', snapshot: null, confirmNo: null,
        publishedAt: null, aiUsage: { greeting: 0, intro: 0 }, createdAt: now(), updatedAt: now(),
      };
      d.csr_reports.push(r);
      save();
      return r;
    },
    async aiDraft(id, section, memo) {
      await wait(700);
      const { d, org } = await requireOrg();
      const r = ownReport(d, org, id);
      if (r.status === 'PUBLISHED') fail(400, '발행된 보고서는 수정할 수 없습니다.');
      const used = r.aiUsage[section];
      if (used >= 3) fail(429, 'AI 초안은 섹션당 3회까지 만들 수 있습니다.');
      // 입력: 기관 DB 정보 + 담당자 메모만. 청년 개인정보는 보내지 않음. 숫자는 자리 표시로만.
      const m = memo.trim().slice(0, 300);
      const text = section === 'greeting' ? AI_TEMPLATES.greeting[used](org.name, m) : AI_TEMPLATES.intro[used](org.name, m, org.intro || '지역 주민을 위한 다양한 프로그램을 운영합니다.');
      r.aiUsage[section] = used + 1;
      r.sections[section] = text;
      r.updatedAt = now();
      save();
      return { text, report: r };
    },
  },


  verify: {
    async lookup(no) {
      await wait();
      const d = await db();
      const key = no.trim().toUpperCase();
      const r = d.csr_reports.find((x) => x.status === 'PUBLISHED' && x.confirmNo === key);
      if (r && r.snapshot) {
        return { kind: 'CSR', confirmNo: key, title: r.snapshot.orgName, year: r.year, totalValue: r.snapshot.totalValue, totalHours: r.snapshot.totalHours, issuedAt: r.publishedAt!, version: r.version };
      }
      const res = d.resumes.find((x) => x.doc.confirmNo === key);
      if (res) {
        return { kind: 'RESUME', confirmNo: key, title: maskName(res.doc.user.name), year: Number(res.doc.issuedAt.slice(0, 4)), totalValue: res.doc.totalValue, totalHours: res.doc.totalHours, issuedAt: res.doc.issuedAt };
      }
      return fail(404, '일치하는 확인번호가 없습니다. 번호를 다시 확인해 주세요.');
    },
  },

  support: {
    async notices() {
      await wait(60);
      return (await db()).notices;
    },
    async faqs() {
      await wait(60);
      return (await db()).faqs;
    },
  },

  stats: {
    async platform() {
      await wait(60);
      const d = await db();
      const approved = d.participations.filter((p) => p.status === 'APPROVED');
      return {
        youthCount: new Set(approved.map((p) => p.userId)).size,
        orgCount: d.organizations.filter((o) => o.verificationStatus === 'APPROVED').length,
        totalHours: sumHours(approved),
        totalValue: sumValue(approved),
      };
    },
  },
};
