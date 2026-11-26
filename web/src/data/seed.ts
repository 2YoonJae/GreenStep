// 가상 데이터. 실제 기관·회사·인물과 무관한 예시입니다.
// http 모드(실서버)에서는 사용하지 않습니다.
import { REGION_CODE } from './types';
import type {
  Activity,
  ActivitySource,
  ActivityStatus,
  Application,
  Category,
  CsrReport,
  Faq,
  Notice,
  OrgKey,
  OrgMember,
  Organization,
  Participation,
  ParticipationStatus,
  Region,
  User,
} from './types';
import { hoursBetween, rateOf, socialValue } from '../lib/sroi';

const T0 = '2026-01-05T09:00:00.000Z';

/* ───────── 계정 ───────── */
// 데모 비밀번호는 모두 demo1234. 목업 API는 SHA-256 해시로 비교(실서버는 argon2).
export const DEMO_PASSWORD = 'demo1234';

const user = (id: string, email: string, name: string, school: string, targetField: string): User => ({
  id, email, name, accountStatus: 'ACTIVE', createdAt: T0, updatedAt: T0, school, targetField, marketingConsent: false,
});

export const seedUsers: User[] = [
  user('u1', 'youth@demo.kr', '김지원', '한국대학교 사회복지학과', '복지관'),
  user('u2', 'u2@demo.kr', '이서준', '서울대학교', '병원'),
  user('u3', 'u3@demo.kr', '박하은', '경기대학교', '유치원·어린이집'),
  user('u4', 'u4@demo.kr', '최도윤', '인하대학교', 'ESG·CSR 기업'),
  user('u5', 'u5@demo.kr', '정민서', '가천대학교', '요양원'),
  user('u6', 'u6@demo.kr', '강예린', '아주대학교', '지역아동센터'),
  user('u7', 'u7@demo.kr', '윤시우', '한양대학교', '복지관'),
  user('u8', 'u8@demo.kr', '임채원', '부산대학교', '병원'),
];

const org = (o: Omit<Organization, 'verificationStatus' | 'shortage' | 'difficulty' | 'vulnerable' | 'createdAt' | 'contactEmail'> & Partial<Organization>): Organization => ({
  verificationStatus: 'APPROVED',
  contactEmail: `contact-${o.id}@demo.kr`,
  shortage: false,
  difficulty: false,
  vulnerable: false,
  createdAt: T0,
  ...o,
});

export const seedOrgs: Organization[] = [
  org({ id: 'o1', name: '성남 이웃돌봄복지관', organizationType: 'WELFARE_CENTER', businessNo: '1298210001', address: '경기 성남시 수정구 이웃로 12', intro: '성남 지역 어르신과 아동을 위한 돌봄·여가 프로그램을 운영하는 종합사회복지관입니다.' }),
  org({ id: 'o2', name: '마포 청년배움센터', organizationType: 'NONPROFIT', businessNo: '1058210002', address: '서울 마포구 배움길 34', intro: '지역 아동·청소년의 학습을 지원하는 비영리 교육기관입니다.' }),
  org({ id: 'o3', name: '우리동네 환경모임', organizationType: 'NONPROFIT', businessNo: '2068210003', address: '서울 성동구 하천로 8', intro: '하천·공원 정화 활동을 하는 주민 환경단체입니다.' }),
  org({ id: 'o4', name: '인천 나눔부엌', organizationType: 'NONPROFIT', businessNo: '1318210004', address: '인천 남동구 나눔대로 5', intro: '결식 이웃에게 도시락을 전하는 지역 나눔 단체입니다.' }),
  org({ id: 'o5', name: '부산 디지털배움터', organizationType: 'PUBLIC', businessNo: '6178310005', address: '부산 해운대구 센텀로 21', intro: '지자체가 운영하는 시민 디지털 교육 공간입니다.' }),
  org({ id: 'o6', name: '경기 함께동물보호소', organizationType: 'WELFARE_FACILITY', businessNo: '1428210006', address: '경기 용인시 처인구 보호소길 3', intro: '유기동물 보호와 입양을 돕는 민간 보호소입니다.' }),
];

/** 기관 회원가입 시연용 기관 코드 키 (서버 backend/app/seed.py DEMO_ORG_KEYS 와 같은 값) */
export const seedOrgKeys: OrgKey[] = ['GS-DEMO-0001', 'GS-DEMO-0002', 'GS-DEMO-0003'].map((keyCode) => ({
  keyCode, organizationId: null, issuedAt: T0, usedAt: null,
}));

export const seedMembers: OrgMember[] = [
  { id: 'm1', userId: 'mu1', organizationId: 'o1', email: 'org@demo.kr', name: '한지민', role: 'OWNER', membershipStatus: 'ACTIVE', joinedAt: T0 },
  { id: 'm2', userId: 'mu2', organizationId: 'o2', email: 'mapo@demo.kr', name: '오세훈', role: 'OWNER', membershipStatus: 'ACTIVE', joinedAt: T0 },
];

/* ───────── 활동 ───────── */

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 시드 입력은 짧게 쓰고 activities 테이블 모양으로 변환 (region + district → region_code · region_name 등) */
type A = Partial<Activity> & {
  id: string;
  orgId: string | null;
  orgName: string;
  title: string;
  category: Category;
  region: Region;
  district: string;
  startDate: string;
  endDate: string;
  deadline: string;
  hoursPerSession: number;
  appliedCount?: number;
  source?: ActivitySource;
};
const act = ({ orgId, region, district, startDate, endDate, deadline, appliedCount, source, ...a }: A): Activity => ({
  organizationId: orgId,
  sourceType: source ?? 'GREENSTEP',
  externalActivityId: source === '1365' ? `1365-${a.id}` : null,
  externalUrl: source === '1365' ? 'https://www.1365.go.kr' : null,
  externalOrgName: source === '1365' ? a.orgName : null,
  description: '',
  sourceCategory: null,
  regionCode: REGION_CODE[region],
  regionName: `${region} ${district}`,
  address: `${region} ${district}`,
  recruitStartDate: addDays(deadline, -21),
  recruitEndDate: deadline,
  activityStartDate: startDate,
  activityEndDate: endDate,
  capacity: 10,
  applicantCount: appliedCount ?? 0,
  status: 'RECRUITING' as ActivityStatus,
  createdAt: T0,
  updatedAt: T0,
  summary: '',
  targetGroup: '',
  tasks: '',
  individualSupport: false,
  difficultyReason: null,
  weight: 1,
  weightStatus: 'NONE',
  weightFlags: { difficulty: false, shortage: false, vulnerable: false },
  views: 0,
  ...a,
});
const confirmed = { weight: 1.2, weightStatus: 'CONFIRMED' as const, weightFlags: { difficulty: true, shortage: false, vulnerable: false } };

export const seedActivities: Activity[] = [
  act({
    id: 'a1', orgId: 'o2', orgName: '마포 청년배움센터', title: '아이들의 배움에 함께하는\n주말 학습 멘토링', category: 'education', region: '서울', district: '마포구',
    startDate: '2026-12-05', endDate: '2026-12-26', deadline: '2026-12-04', hoursPerSession: 3, capacity: 12, appliedCount: 9, views: 412,
    summary: '초등학생과 1:1로 짝을 지어 주말 학습을 돕습니다.',
    description: '매주 토요일 오전, 지역 초등학생 한 명과 짝을 이뤄 국어·수학 숙제와 독서를 함께합니다.\n첫 회차에 30분 오리엔테이션이 있습니다.',
    targetGroup: '지역 초등학생(아동)', tasks: '1:1 학습지도, 독서 멘토링', individualSupport: true,
    difficultyReason: '도움이 필요한 대상을 1:1로 직접 지원하는 활동으로 분류되었습니다.', ...confirmed,
  }),
  act({
    id: 'a2', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '어르신과 나누는\n따뜻한 일상', category: 'care', region: '경기', district: '성남시',
    startDate: '2026-12-01', endDate: '2026-12-20', deadline: '2026-11-26', hoursPerSession: 3, capacity: 10, appliedCount: 8, views: 388,
    summary: '복지관 프로그램실에서 어르신들과 여가 활동을 함께합니다.',
    description: '어르신 여가 프로그램(만들기·노래교실)을 진행하는 동안 준비와 진행을 돕습니다.',
    targetGroup: '지역 어르신', tasks: '여가 프로그램 진행 보조, 말벗', individualSupport: false,
    difficultyReason: '개별(1:1) 지원 활동이 아닙니다.',
  }),
  act({
    id: 'a3', orgId: 'o3', orgName: '우리동네 환경모임', title: '우리 동네 하천을 지키는\n주말 플로깅', category: 'environment', region: '서울', district: '성동구',
    startDate: '2026-12-12', endDate: '2026-12-12', deadline: '2026-12-05', hoursPerSession: 2, capacity: 30, appliedCount: 17, views: 351,
    summary: '중랑천 산책로를 걸으며 쓰레기를 줍습니다.', description: '집게와 봉투는 현장에서 나눠 드립니다. 편한 운동화를 신고 오세요.',
    targetGroup: '지역 주민', tasks: '플로깅, 쓰레기 분류',
  }),
  act({
    id: 'a4', orgId: 'o4', orgName: '인천 나눔부엌', title: '이웃에게 전하는\n한 끼 도시락 나눔', category: 'environment', region: '인천', district: '남동구',
    startDate: '2026-12-13', endDate: '2026-12-13', deadline: '2026-12-06', hoursPerSession: 4, capacity: 15, appliedCount: 6, views: 320,
    summary: '도시락을 만들고 포장해 이웃에게 전달합니다.', description: '조리·포장 후 인근 가정에 배달합니다. 위생모와 앞치마를 제공합니다.',
    targetGroup: '결식 이웃', tasks: '조리 보조, 포장, 배달',
  }),
  act({
    id: 'a5', orgId: 'o5', orgName: '부산 디지털배움터', title: '처음 만나는 디지털,\n함께 배우기', category: 'education', region: '부산', district: '해운대구',
    startDate: '2026-12-19', endDate: '2026-12-19', deadline: '2026-12-10', hoursPerSession: 2, capacity: 8, appliedCount: 3, views: 298,
    summary: '어르신께 스마트폰 사용법을 알려 드립니다.', description: '강사가 수업을 진행하고, 봉사자는 테이블을 돌며 질문을 돕습니다.',
    targetGroup: '디지털 교육 수강 시민', tasks: '수업 보조, 안내',
  }),
  act({
    id: 'a6', orgId: 'o6', orgName: '경기 함께동물보호소', title: '유기동물의 새로운 하루를\n함께 만드는 시간', category: 'environment', region: '경기', district: '용인시',
    startDate: '2026-12-20', endDate: '2026-12-20', deadline: '2026-12-11', hoursPerSession: 3, capacity: 12, appliedCount: 10, views: 276,
    summary: '보호소 견사 청소와 산책 봉사를 합니다.', description: '견사 청소, 사료 정리, 산책을 돕습니다. 오염되어도 괜찮은 옷을 준비해 주세요.',
    targetGroup: '보호 동물', tasks: '청소, 사료 정리, 산책',
  }),
  act({
    id: 'a7', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '방과후 아동 1:1 돌봄 교실', category: 'care', region: '경기', district: '성남시',
    startDate: '2026-12-02', endDate: '2027-01-27', deadline: '2026-12-12', hoursPerSession: 3, capacity: 8, appliedCount: 3, views: 233,
    summary: '맞벌이 가정 아동과 1:1로 숙제와 놀이를 함께합니다.', description: '평일 오후 3시~6시. 아동 한 명을 맡아 숙제 지도와 정서 지원을 합니다.',
    targetGroup: '초등 저학년 아동', tasks: '1:1 돌봄, 숙제 지도, 정서 지원', individualSupport: true,
    difficultyReason: '도움이 필요한 대상을 1:1로 직접 지원하는 활동으로 분류되었습니다.', ...confirmed,
  }),
  act({
    id: 'a8', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '재활 프로그램 보조와 이동 동행', category: 'health', region: '경기', district: '성남시',
    startDate: '2026-12-08', endDate: '2026-12-29', deadline: '2026-12-15', hoursPerSession: 2, capacity: 6, appliedCount: 1, views: 88,
    summary: '거동이 불편한 어르신의 재활 운동과 이동을 돕습니다.', description: '물리치료사 지도 아래 어르신 한 분의 재활 운동과 이동을 보조합니다.',
    targetGroup: '거동이 불편한 어르신(환자)', tasks: '재활 보조, 이동 보조', individualSupport: true,
    difficultyReason: '도움이 필요한 대상을 1:1로 직접 지원하는 활동으로 분류되었습니다.',
    weight: 1, weightStatus: 'CANDIDATE', weightFlags: { difficulty: false, shortage: false, vulnerable: false },
  }),
  act({
    id: 'a9', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '겨울방학 아동 점심 지원', category: 'care', region: '경기', district: '성남시',
    startDate: '2027-01-05', endDate: '2027-02-20', deadline: '2026-12-28', hoursPerSession: 2, capacity: 10, status: 'DRAFT',
    summary: '방학 중 아동 점심 배식을 돕습니다.', targetGroup: '아동', tasks: '배식, 정리',
  }),
  // 1365 공공데이터 API 수집분 (서버 워커가 적재 · 화면은 우리 DB만 읽음)
  act({
    id: 'a10', orgId: null, orgName: '강동 노인종합복지관', source: '1365', title: '어르신 점심 배식 봉사', category: 'care', region: '서울', district: '강동구',
    startDate: '2026-12-01', endDate: '2026-12-31', deadline: '2026-12-05', hoursPerSession: 3, capacity: 20, appliedCount: 11, views: 140,
    summary: '1365 자원봉사포털 모집 공고입니다.', description: '활동 후 1365에서 발급한 활동확인서를 제출하면 검증 후 사회적 가치로 반영됩니다.',
    targetGroup: '어르신', tasks: '배식, 정리',
  }),
  act({
    id: 'a11', orgId: null, orgName: '대전 장애인종합복지관', source: '1365', title: '주말 나들이 동행 봉사', category: 'health', region: '대전', district: '서구',
    startDate: '2026-12-06', endDate: '2026-12-27', deadline: '2026-12-03', hoursPerSession: 4, capacity: 10, appliedCount: 4, views: 97,
    summary: '1365 자원봉사포털 모집 공고입니다.', description: '활동 후 1365에서 발급한 활동확인서를 제출하면 검증 후 사회적 가치로 반영됩니다.',
    targetGroup: '장애인', tasks: '이동 보조, 나들이 동행',
  }),
  // 종료된 활동 (2026년 실적의 근거)
  act({
    id: 'c1', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '여름방학 아동 학습 돌봄', category: 'care', region: '경기', district: '성남시',
    startDate: '2026-07-20', endDate: '2026-08-21', deadline: '2026-07-10', hoursPerSession: 3, capacity: 10, appliedCount: 10, status: 'CLOSED', views: 310,
    targetGroup: '초등학생 아동', tasks: '1:1 학습지도, 돌봄', individualSupport: true, ...confirmed,
  }),
  act({
    id: 'c2', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '어르신 스마트폰 교실', category: 'education', region: '경기', district: '성남시',
    startDate: '2026-03-04', endDate: '2026-06-24', deadline: '2026-02-25', hoursPerSession: 2, capacity: 8, appliedCount: 8, status: 'CLOSED', views: 205,
    targetGroup: '어르신', tasks: '수업 보조', individualSupport: false,
  }),
  act({
    id: 'c3', orgId: 'o1', orgName: '성남 이웃돌봄복지관', title: '가을 김장 나눔', category: 'environment', region: '경기', district: '성남시',
    startDate: '2026-11-07', endDate: '2026-11-14', deadline: '2026-11-01', hoursPerSession: 4, capacity: 20, appliedCount: 14, status: 'CLOSED', views: 260,
    targetGroup: '독거 어르신 가정', tasks: '김장 보조, 포장, 배달',
  }),
  act({
    id: 'c4', orgId: 'o2', orgName: '마포 청년배움센터', title: '1학기 학습 멘토링', category: 'education', region: '서울', district: '마포구',
    startDate: '2026-03-07', endDate: '2026-06-27', deadline: '2026-02-28', hoursPerSession: 3, capacity: 12, appliedCount: 12, status: 'CLOSED', views: 280,
    targetGroup: '초등학생', tasks: '1:1 학습지도', individualSupport: true, ...confirmed,
  }),
];

/* ───────── 활동 기록 ───────── */

let pid = 0;
function rec(userId: string, activityId: string, date: string, start: string, end: string, status: ParticipationStatus, extra: Partial<Participation> = {}): Participation {
  const a = seedActivities.find((x) => x.id === activityId)!;
  const u = seedUsers.find((x) => x.id === userId)!;
  const hours = hoursBetween(start, end);
  const rate = rateOf(a.category);
  return {
    id: `p${++pid}`,
    userId,
    userName: u.name,
    activityId,
    orgId: a.organizationId,
    activityTitle: a.title,
    orgName: a.orgName,
    category: a.category,
    source: 'GREENSTEP',
    date,
    startTime: start,
    endTime: end,
    hours,
    rateSnapshot: rate,
    weightSnapshot: a.weight,
    valueKrw: socialValue(hours, rate, a.weight),
    status,
    note: '',
    certificateName: null,
    rejectReason: status === 'REJECTED' ? '활동 일지와 시간이 일치하지 않습니다.' : null,
    submittedAt: `${date}T18:00:00.000Z`,
    reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? `${date}T20:00:00.000Z` : null,
    ...extra,
  };
}

const many: Participation[] = [];
// 어르신 스마트폰 교실 (3~6월)
['2026-03-11', '2026-04-08', '2026-05-13', '2026-06-10'].forEach((d, i) => {
  ['u2', 'u3', 'u5'].forEach((u, j) => many.push(rec(u, 'c2', d, '14:00', '16:00', i === 3 && j === 2 ? 'REJECTED' : 'APPROVED')));
});
// 여름방학 아동 학습 돌봄 (7~8월)
['2026-07-22', '2026-07-29', '2026-08-05', '2026-08-12', '2026-08-19'].forEach((d) => {
  ['u1', 'u3', 'u6', 'u7'].forEach((u) => many.push(rec(u, 'c1', d, '13:00', '16:00', 'APPROVED')));
});
// 가을 김장 나눔 (11월) — 일부는 승인 대기
['u1', 'u2', 'u4', 'u5', 'u6', 'u7', 'u8'].forEach((u, i) =>
  many.push(rec(u, 'c3', i < 4 ? '2026-11-07' : '2026-11-14', '09:00', '13:00', i >= 4 ? 'PENDING' : 'APPROVED')),
);
// 마포 1학기 멘토링
['2026-03-14', '2026-04-11', '2026-05-16'].forEach((d) => {
  ['u1', 'u4'].forEach((u) => many.push(rec(u, 'c4', d, '10:00', '13:00', 'APPROVED')));
});
many.push(rec('u1', 'c3', '2026-11-14', '09:00', '13:30', 'PENDING', { note: '김장 후 배달까지 참여했습니다.' }));
many.push(rec('u1', 'c2', '2026-06-10', '14:00', '17:00', 'REJECTED', { rejectReason: '해당 회차 출석 명단에 없습니다.' }));
// 1365 외부 활동 — 확인서 첨부, 검증 대기
many.push({
  ...rec('u1', 'a10', '2026-10-25', '11:00', '14:00', 'EXTERNAL_PENDING'),
  source: '1365',
  orgId: null,
  activityId: null,
  activityTitle: '어르신 점심 배식 봉사 (1365)',
  certificateName: '1365_활동확인서_20261025.pdf',
});

export const seedParticipations: Participation[] = many;

export const seedApplications: Application[] = [
  { id: 'ap1', activityId: 'a1', userId: 'u1', status: 'APPLIED', createdAt: '2026-11-20T10:00:00.000Z' },
  { id: 'ap2', activityId: 'a7', userId: 'u1', status: 'APPLIED', createdAt: '2026-11-21T10:00:00.000Z' },
];

/* ───────── 고객지원 ───────── */

export const seedNotices: Notice[] = [
  { id: 'n1', pinned: true, date: '2026-11-24', title: 'GreenStep 서비스 미리보기 이용 안내', body: '이 웹은 GreenStep 기획안을 바탕으로 만든 시연 버전입니다.\n· 기관명·공고는 모두 예시입니다.\n· 데이터는 이 브라우저에만 저장되며, 다른 기기와 공유되지 않습니다.\n· 사회적 가치는 추정값이며 금전 지급을 의미하지 않습니다.' },
  { id: 'n2', pinned: false, date: '2026-11-18', title: '직무 난이도 가중치 자동 분류 안내', body: '기관이 등록한 활동은 대상자·수행 업무·1:1 지원 여부로 직무 난이도 가중치(+0.2) 후보를 자동 분류합니다. 운영자 확인 전까지는 가중치 1.0으로 계산됩니다.' },
  { id: 'n3', pinned: false, date: '2026-11-10', title: '1365 활동확인서 제출 기능 안내', body: '1365 자원봉사포털에서 활동한 기록도 활동확인서를 첨부해 제출할 수 있습니다. 검증이 끝나기 전까지는 이력서·집계에 반영되지 않습니다.' },
  { id: 'n4', pinned: false, date: '2026-11-01', title: '모집 부족·취약 지역 가중치 기준 검토 중', body: '모집 부족(+0.2), 취약 지역(+0.1) 가중치는 세부 기준을 확정한 뒤 적용합니다. 현재는 직무 난이도(+0.2)만 적용합니다.' },
];

export const seedFaqs: Faq[] = [
  { id: 'f1', category: '사회적 가치', q: '사회적 가치는 어떻게 계산하나요?', a: '활동 시간 × 분야별 표준 단가 × 기관 가중치(1.0~1.5)로 계산합니다. 표준 단가는 2026년 최저임금 10,320원, 돌봄·보육은 아이돌보미 기본 시급 11,120원입니다.' },
  { id: 'f2', category: '사회적 가치', q: '기준이 바뀌면 지난 기록의 가치도 바뀌나요?', a: '아니요. 단가와 가중치는 기록을 제출한 시점의 값으로 고정됩니다.' },
  { id: 'f3', category: '청년', q: '봉사 이력서에는 어떤 기록이 들어가나요?', a: '주최 기관이 승인(APPROVED)한 기록만 들어갑니다. 승인 대기·반려·검증 대기 기록은 반영되지 않습니다.' },
  { id: 'f4', category: '청년', q: '1365에서 한 봉사도 등록할 수 있나요?', a: '활동 기록 제출에서 \'외부(1365) 활동\'을 선택하고 활동확인서를 첨부하면 됩니다. 검증 후 반영됩니다.' },
  { id: 'f5', category: '기관', q: '기관 가입 후 바로 활동을 등록할 수 있나요?', a: '사업자등록번호 확인 등 운영자 심사가 끝나면 활동을 등록할 수 있습니다. 심사 중에도 로그인과 기관 정보 확인은 가능합니다.' },
  { id: 'f6', category: '기관', q: '가중치를 기관이 직접 정할 수 있나요?', a: '아니요. 가중치는 사회적 가치 금액을 올리기 때문에 운영자만 설정합니다. 기관이 입력한 대상자·업무 정보로 후보를 자동 분류합니다.' },
  { id: 'f7', category: '기관', q: 'ESG 경영 보고서에는 봉사자 개인정보가 들어가나요?', a: '아니요. 보고서에는 참여 인원수만 표시합니다.' },
];

/* ───────── 발행된 ESG 경영 보고서 예시 (확인번호 조회용) ───────── */

export const seedReports: CsrReport[] = [
  {
    id: 'r-seed-1', orgId: 'o2', year: 2025, version: 1, theme: 'teal', status: 'PUBLISHED',
    sections: { greeting: '', intro: '', highlights: '', plan: '' }, aiUsage: { greeting: 0, intro: 0 },
    snapshot: {
      orgId: 'o2', orgName: '마포 청년배움센터', year: 2025, totalValue: 4_458_240, totalHours: 360, youthCount: 18, approvedCount: 120, rejectedCount: 4, approvalRate: 0.968, activityCount: 3,
      monthly: [], byActivity: [], generatedAt: '2026-01-15T09:00:00.000Z',
    },
    confirmNo: 'GS-2025-0002-7K3Q', paidAt: '2026-01-15T09:00:00.000Z', publishedAt: '2026-01-15T09:10:00.000Z', createdAt: '2026-01-15T09:00:00.000Z', updatedAt: '2026-01-15T09:10:00.000Z',
  },
];

export const SEED_REGIONS: Region[] = ['서울', '경기', '인천', '부산', '대전'];
