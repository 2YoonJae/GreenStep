import type {
  Activity,
  ActivityInput,
  ActivityQuery,
  ActivityStatus,
  AiSection,
  ApplicationView,
  CsrReport,
  ExternalParticipationInput,
  Faq,
  Notice,
  OrgDashboard,
  OrgType,
  Organization,
  Page,
  Participation,
  ParticipationInput,
  ParticipationStatus,
  PlatformStats,
  ReportSnapshot,
  ReportTheme,
  ReportSections,
  ResumeDoc,
  Session,
  User,
  VerifyResult,
} from '../data/types';

/**
 * 화면이 사용하는 API 계약.
 * - mock 구현: src/api/mock (브라우저 localStorage, 서버 권한 검사를 흉내)
 * - http 구현: src/api/http (FastAPI /api/v1, 경로는 endpoints.ts)
 * 화면은 반드시 이 인터페이스만 사용합니다. 저장소(localStorage)를 직접 건드리지 않습니다.
 */

/* 가입 입력은 저장될 테이블 단위로 나눠 보냅니다 (backend/app/schemas.py 와 같은 모양) */

/** user_profiles */
export interface UserProfileInput {
  school: string;
  targetField: string;
  marketingConsent: boolean;
}

/** 청년 가입 → users + user_profiles (user_id · account_status · 일시는 서버가 정함) */
export interface YouthSignupInput {
  email: string;
  password: string; // 서버가 argon2 해시로 password_hash 에 저장
  name: string;
  profile: UserProfileInput;
}

/**
 * 기관 가입 → organizations(심사 대기) + organization_profiles(빈 소개) + 담당자 users + org_members(OWNER).
 * GreenStep 이 발급한 미사용 기관 코드 키(organization_keys)가 있어야 가입됩니다.
 */
export interface OrgSignupInput {
  /** organizations (organization_id · verification_status · created_at 은 서버가 정함) */
  organization: {
    name: string;
    organizationType: OrgType;
    address: string;
    contactEmail: string;
    businessNo: string;
    businessApiKey: string; // 기관 코드 키 (organizations.business_api_key)
  };
  /** 담당자 계정 → users, org_members(role=OWNER, membership_status=ACTIVE) */
  manager: { name: string; email: string; password: string };
}

export interface MeUpdateInput {
  name?: string;
  profile?: UserProfileInput;
}

export interface ActivityDetail extends Activity {
  /** 로그인한 청년의 신청 여부 */
  applied: boolean;
}

export interface Api {
  mode: 'mock' | 'http';

  auth: {
    loginYouth(email: string, password: string): Promise<Session>;
    loginOrg(email: string, password: string): Promise<Session>;
    signupYouth(input: YouthSignupInput): Promise<Session>;
    signupOrg(input: OrgSignupInput): Promise<Session>;
    /** 새로고침 시 세션 복구 (http: refresh 쿠키로 access 토큰 재발급) */
    restore(): Promise<Session | null>;
    logout(): Promise<void>;
  };

  activities: {
    list(q: ActivityQuery): Promise<Page<Activity>>;
    get(id: string): Promise<ActivityDetail>;
  };

  applications: {
    mine(): Promise<ApplicationView[]>;
    apply(activityId: string): Promise<void>;
    cancel(activityId: string): Promise<void>;
  };

  participations: {
    mine(): Promise<Participation[]>;
    submit(input: ParticipationInput): Promise<Participation>;
    submitExternal(input: ExternalParticipationInput): Promise<Participation>;
  };

  resume: {
    latest(): Promise<ResumeDoc | null>;
    issue(): Promise<ResumeDoc>;
  };

  me: {
    update(input: MeUpdateInput): Promise<User>;
  };

  org: {
    me(): Promise<Organization>;
    dashboard(): Promise<OrgDashboard>;
    activities(): Promise<Activity[]>;
    activity(id: string): Promise<Activity>;
    createActivity(input: ActivityInput): Promise<Activity>;
    updateActivity(id: string, input: ActivityInput): Promise<Activity>;
    setActivityStatus(id: string, status: ActivityStatus): Promise<Activity>;
    deleteActivity(id: string): Promise<void>;
    participations(status?: ParticipationStatus): Promise<Participation[]>;
    approve(id: string): Promise<Participation>;
    reject(id: string, reason: string): Promise<Participation>;
    /** 데모 전용 — 운영자 심사 화면이 생기기 전까지 심사 승인을 흉내 (http: 서버 DEMO_MODE=true 일 때만) */
    demoApproveReview?(): Promise<Organization>;
  };

  reports: {
    summary(year: number): Promise<ReportSnapshot>;
    list(): Promise<CsrReport[]>;
    create(year: number): Promise<CsrReport>;
    update(id: string, patch: { theme?: ReportTheme; sections?: Partial<ReportSections> }): Promise<CsrReport>;
    /** 실결제 없음 — '결제 완료' 버튼 */
    markPaid(id: string): Promise<CsrReport>;
    /** 발행: 집계 스냅샷 고정 + 확인번호 발급. 발행 후 수정은 새 버전 */
    publish(id: string): Promise<CsrReport>;
    newVersion(id: string): Promise<CsrReport>;
    /** AI 초안 (인사말·기관 소개만, 섹션당 3회). 숫자는 자리 표시로 받고 서버가 채움 */
    aiDraft(id: string, section: AiSection, memo: string): Promise<{ text: string; report: CsrReport }>;
  };

  verify: {
    lookup(confirmNo: string): Promise<VerifyResult>;
  };

  support: {
    notices(): Promise<Notice[]>;
    faqs(): Promise<Faq[]>;
  };

  stats: {
    platform(): Promise<PlatformStats>;
  };
}
