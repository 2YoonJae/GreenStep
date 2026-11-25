// API 스키마 기준 타입. 백엔드(FastAPI) 응답 JSON과 같은 모양을 유지합니다.
// 테이블은 노션 「GreenStep_기술_아키텍처」 1. 회원·기관 DB (backend/alembic/versions/0001_initial_schema.sql)
// 응답 타입 = 테이블 + 1:1 확장 테이블을 합친 한 행 (필드 이름은 컬럼 이름의 camelCase)

export type ID = string;
export type ISODate = string; // 2026-08-15
export type ISODateTime = string; // 2026-08-15T09:00:00.000Z

/* ───────── 회원 · 기관 (users / organizations / org_members) ───────── */

export type Role = 'YOUTH' | 'ORG';

/** 청년 프로필의 희망 분야 (user_profiles.target_field · 봉사 이력서에 표시) */
export const TARGET_FIELDS = ['유치원·어린이집', '요양원', '병원', '복지관', '지역아동센터', 'ESG·CSR 기업'] as const;

/** users.account_status — 활성 / 정지 / 탈퇴 */
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN';

export interface User {
  /* users */
  id: ID; // user_id
  email: string;
  name: string;
  accountStatus: AccountStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /* user_profiles (확장) */
  school: string;
  targetField: string; // 희망 분야
  marketingConsent: boolean;
}

/** organizations.organization_type */
export type OrgType = 'WELFARE_CENTER' | 'WELFARE_FACILITY' | 'NONPROFIT' | 'PUBLIC' | 'COMPANY' | 'OTHER';
export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  WELFARE_CENTER: '종합사회복지관',
  WELFARE_FACILITY: '복지시설',
  NONPROFIT: '비영리단체',
  PUBLIC: '공공기관',
  COMPANY: '기업',
  OTHER: '기타',
};

/** organizations.verification_status — 기관 등록 심사. APPROVED 가 되어야 활동 등록 가능 */
export type OrgVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Organization {
  /* organizations */
  id: ID; // organization_id
  name: string;
  organizationType: OrgType;
  verificationStatus: OrgVerificationStatus;
  address: string;
  contactEmail: string; // 기관 공식 이메일
  createdAt: ISODateTime;
  businessNo: string; // 사업자등록번호 숫자 10자리
  /* organization_profiles (확장) */
  intro: string;
  /** SROI 가중치 플래그 — 운영자만 설정. 기관은 수정 불가 */
  shortage: boolean;
  difficulty: boolean;
  vulnerable: boolean;
}

/** org_members.role — 기관 관리자 / 담당자 */
export type OrgMemberRole = 'OWNER' | 'MANAGER';
/** org_members.membership_status — 승인 대기 / 활성 / 해제 */
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REMOVED';

export interface OrgMember {
  /* org_members */
  id: ID; // member_id
  userId: ID;
  organizationId: ID;
  role: OrgMemberRole;
  membershipStatus: MembershipStatus;
  joinedAt: ISODateTime;
  /* users (담당자 계정) */
  email: string;
  name: string;
}

/** 로그인 결과. http 모드에서 accessToken 은 메모리에만, refresh 는 httpOnly 쿠키 */
export interface Session {
  role: Role;
  accessToken: string;
  user?: User;
  member?: OrgMember;
  org?: Organization;
}

/* ───────── 활동 (activities) ───────── */

/** 시·도 (17개 광역자치단체) */
export type Region =
  | '서울' | '부산' | '대구' | '인천' | '광주' | '대전' | '울산' | '세종'
  | '경기' | '강원' | '충북' | '충남' | '전북' | '전남' | '경북' | '경남' | '제주';
/** 시·도 → 행정구역 코드 (activities.region_code). 백엔드 app/domain.py 와 같은 값 */
export const REGION_CODE: Record<Region, string> = {
  서울: '11', 부산: '26', 대구: '27', 인천: '28', 광주: '29', 대전: '30', 울산: '31', 세종: '36',
  경기: '41', 강원: '51', 충북: '43', 충남: '44', 전북: '52', 전남: '46', 경북: '47', 경남: '48', 제주: '50',
};
export const REGIONS = Object.keys(REGION_CODE) as Region[];
export const regionOfCode = (code: string): Region | undefined => REGIONS.find((r) => REGION_CODE[r] === code);

/** 활동 분야. 분야마다 표준 단가가 정해짐 (lib/sroi.ts) */
export type Category = 'education' | 'care' | 'environment' | 'health';

/** activities.source_type — 1365 = 1365 공공데이터 API 수집분(서버 워커가 적재) */
export type ActivitySource = 'GREENSTEP' | '1365';
/** activities.status — 임시저장 / 모집 중 / 마감 / 취소 */
export type ActivityStatus = 'DRAFT' | 'RECRUITING' | 'CLOSED' | 'CANCELLED';
/** 직무 난이도 가중치 상태. CANDIDATE = 자동 분류 후보(운영자 확인 전, 1.0 적용) */
export type WeightStatus = 'NONE' | 'CANDIDATE' | 'CONFIRMED';

export interface WeightFlags {
  difficulty: boolean; // +0.2
  shortage: boolean; // +0.2 (기준 확정 전 · 보류)
  vulnerable: boolean; // +0.1 (기준 확정 전 · 보류)
}

export interface Activity {
  /* activities */
  id: ID; // activity_id
  organizationId: ID | null; // 1365 수집 공고는 미가입 기관일 수 있음 → NULL
  sourceType: ActivitySource;
  externalActivityId: string | null;
  externalUrl: string | null;
  externalOrgName: string | null;
  title: string;
  description: string;
  category: Category; // GreenStep 표준 활동 분야
  sourceCategory: string | null; // 외부 API 원본 분야
  regionCode: string; // 시·도 코드 (REGION_CODE)
  regionName: string; // 예) 서울 마포구
  address: string;
  recruitStartDate: ISODate;
  recruitEndDate: ISODate; // 모집 마감일
  activityStartDate: ISODate;
  activityEndDate: ISODate;
  capacity: number;
  applicantCount: number;
  status: ActivityStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /* organizations.name 또는 external_org_name */
  orgName: string;
  /* activity_details (확장) */
  summary: string;
  hoursPerSession: number;
  /** 직무 난이도 판단 근거 */
  targetGroup: string; // 대상자
  tasks: string; // 수행 업무
  individualSupport: boolean; // 1:1 개별 지원 여부
  difficultyReason: string | null;
  weight: number; // 실제 적용 가중치 (1.0 ~ 1.5)
  weightStatus: WeightStatus;
  weightFlags: WeightFlags;
  views: number;
}

/** 공고 등록 입력 — activity_details 테이블에 들어갈 값 (가중치·조회수는 서버가 정함) */
export interface ActivityDetailsInput {
  summary: string;
  hoursPerSession: number;
  targetGroup: string;
  tasks: string;
  individualSupport: boolean;
}

/**
 * 공고 등록 입력 — activities 테이블에 들어갈 값.
 * activity_id · organization_id · source_type · external_* · applicant_count · created_at · updated_at 은 서버가 정함
 */
export interface ActivityInput {
  title: string;
  description: string;
  category: Category;
  regionCode: string;
  regionName: string;
  address: string;
  recruitStartDate: ISODate;
  recruitEndDate: ISODate;
  activityStartDate: ISODate;
  activityEndDate: ISODate;
  capacity: number;
  status: Extract<ActivityStatus, 'DRAFT' | 'RECRUITING'>;
  details: ActivityDetailsInput;
}

export type ActivitySort = 'recommended' | 'popular' | 'deadline' | 'value' | 'latest';

export interface ActivityQuery {
  q?: string;
  region?: Region | '';
  category?: Category | '';
  /** 공고 출처 (빈 값 = 전체) */
  source?: ActivitySource | '';
  sort?: ActivitySort;
  /** 가산 조건: 가중치가 적용(또는 후보)된 활동만 */
  bonus?: boolean;
  /** 마감 N일 이내 */
  closingWithinDays?: number;
  page?: number;
  pageSize?: number;
}

/* ───────── 신청 (applications) ───────── */

export type ApplicationStatus = 'APPLIED' | 'CANCELLED';

export interface Application {
  id: ID;
  activityId: ID;
  userId: ID;
  status: ApplicationStatus;
  createdAt: ISODateTime;
}

export interface ApplicationView extends Application {
  activity: Activity;
}

/* ───────── 활동 기록 (participations) — 모든 결과의 원천 ───────── */

export type ParticipationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXTERNAL_PENDING';

export interface Participation {
  id: ID;
  userId: ID;
  /** 기관 승인 화면에서만 내려옴. 보고서·AI 에는 사용하지 않음 */
  userName: string;
  activityId: ID | null;
  orgId: ID | null;
  activityTitle: string;
  orgName: string;
  category: Category;
  source: ActivitySource;
  date: ISODate;
  startTime: string; // 09:00
  endTime: string; // 12:00
  hours: number;
  /** 제출 시점 스냅샷 */
  rateSnapshot: number;
  weightSnapshot: number;
  valueKrw: number;
  status: ParticipationStatus;
  note: string;
  certificateName: string | null; // 1365 활동확인서 파일명
  rejectReason: string | null;
  submittedAt: ISODateTime;
  reviewedAt: ISODateTime | null;
}

export interface ParticipationInput {
  activityId: ID;
  date: ISODate;
  startTime: string;
  endTime: string;
  note: string;
}

/** 1365 등 외부 활동 — 확인서 첨부 → EXTERNAL_PENDING('검증 대기'), 검증 전 집계 미반영 */
export interface ExternalParticipationInput {
  activityTitle: string;
  orgName: string;
  category: Category;
  date: ISODate;
  startTime: string;
  endTime: string;
  note: string;
  certificate: File | null;
}

/* ───────── 봉사 이력서 ───────── */

export interface ResumeDoc {
  confirmNo: string;
  issuedAt: ISODateTime;
  user: Pick<User, 'name' | 'school' | 'targetField'>;
  items: Pick<Participation, 'id' | 'activityTitle' | 'orgName' | 'category' | 'date' | 'hours' | 'weightSnapshot' | 'valueKrw'>[];
  totalHours: number;
  totalValue: number;
}

/* ───────── ESG 경영 보고서 (csr_reports + snapshots) ───────── */

export type ReportTheme = 'teal' | 'green' | 'navy';
export type ReportStatus = 'DRAFT' | 'PAID' | 'PUBLISHED';

export interface MonthlyStat {
  month: number; // 1~12
  value: number;
  hours: number;
  records: number;
  youth: number;
}

export interface ActivityStat {
  activityId: ID | null;
  title: string;
  category: Category;
  value: number;
  hours: number;
  youth: number;
}

/** 집계 스냅샷. 발행 시 고정. 봉사자 개인정보 없이 인원수만 */
export interface ReportSnapshot {
  orgId: ID;
  orgName: string;
  year: number;
  totalValue: number;
  totalHours: number;
  youthCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number; // 0~1
  activityCount: number;
  monthly: MonthlyStat[];
  byActivity: ActivityStat[];
  generatedAt: ISODateTime;
}

export interface ReportSections {
  greeting: string; // 인사말 (AI 초안 가능)
  intro: string; // 기관 소개 (AI 초안 가능)
  highlights: string; // 주요 활동 (기관 입력)
  plan: string; // 내년 계획 (기관 입력)
}

export type AiSection = 'greeting' | 'intro';

export interface CsrReport {
  id: ID;
  orgId: ID;
  year: number;
  version: number;
  theme: ReportTheme;
  status: ReportStatus;
  sections: ReportSections;
  aiUsage: Record<AiSection, number>; // 섹션당 3회
  snapshot: ReportSnapshot | null; // 발행 시 고정
  confirmNo: string | null;
  paidAt: ISODateTime | null;
  publishedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface VerifyResult {
  kind: 'CSR' | 'RESUME';
  confirmNo: string;
  title: string; // 기관명 또는 마스킹된 이름
  year: number;
  totalValue: number;
  totalHours: number;
  issuedAt: ISODateTime;
  version?: number;
}

/* ───────── 대시보드 · 공통 ───────── */

export interface OrgDashboard {
  totalValue: number;
  totalHours: number;
  youthCount: number;
  pendingCount: number;
  approvalRate: number;
  activeActivities: number;
}

export interface PlatformStats {
  youthCount: number;
  orgCount: number;
  totalHours: number;
  totalValue: number;
}

export interface Notice {
  id: ID;
  title: string;
  body: string;
  date: ISODate;
  pinned: boolean;
}

export interface Faq {
  id: ID;
  category: '청년' | '기관' | '사회적 가치' | '기타';
  q: string;
  a: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API 오류. http 모드에서는 FastAPI 의 {detail} 응답을 이 형태로 변환 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
