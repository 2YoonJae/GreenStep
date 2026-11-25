/**
 * FastAPI 엔드포인트 목록 (/api/v1 기준). 백엔드 구현 시 이 경로를 그대로 맞춥니다.
 * 인증: Authorization: Bearer <access>, refresh 는 httpOnly 쿠키 (POST /auth/refresh)
 */
export const EP = {
  auth: {
    youthLogin: '/auth/youth/login', // POST {email,password} → Session
    orgLogin: '/auth/org/login', // POST {email,password} → Session
    youthSignup: '/auth/youth/signup', // POST YouthSignupInput → Session
    orgSignup: '/auth/org/signup', // POST OrgSignupInput → Session (verificationStatus=PENDING)
    refresh: '/auth/refresh', // POST (쿠키) → Session
    logout: '/auth/logout', // POST → 204 (refresh 쿠키 삭제)
  },
  activities: '/activities', // GET ?q&region&category&sort&bonus&closing&page&pageSize → Page<Activity>
  activity: (id: string) => `/activities/${id}`, // GET → ActivityDetail
  applications: (id: string) => `/activities/${id}/applications`, // POST 신청 / DELETE 취소 (YOUTH)
  me: {
    profile: '/me', // PATCH (YOUTH)
    applications: '/me/applications', // GET → ApplicationView[]
    participations: '/me/participations', // GET / POST ParticipationInput
    external: '/me/participations/external', // POST multipart (certificate)
    resume: '/me/resume', // GET 최근 발급본 / POST 발급
  },
  org: {
    me: '/org/me', // GET → Organization (토큰의 org_id 기준)
    demoApprove: '/org/demo/approve-review', // POST → Organization (데모 전용 · DEMO_MODE)
    dashboard: '/org/dashboard',
    activities: '/org/activities', // GET / POST
    activity: (id: string) => `/org/activities/${id}`, // GET / PUT / DELETE (자기 기관만)
    activityStatus: (id: string) => `/org/activities/${id}/status`, // PATCH {status}
    participations: '/org/participations', // GET ?status
    approve: (id: string) => `/org/participations/${id}/approve`, // POST
    reject: (id: string) => `/org/participations/${id}/reject`, // POST {reason}
  },
  reports: {
    summary: '/org/reports/summary', // GET ?year → ReportSnapshot (실시간 집계)
    list: '/org/reports', // GET / POST {year}
    item: (id: string) => `/org/reports/${id}`, // PATCH {theme, sections}
    pay: (id: string) => `/org/reports/${id}/pay`, // POST (데모: 실결제 없음)
    publish: (id: string) => `/org/reports/${id}/publish`, // POST → 스냅샷 고정 + 확인번호
    version: (id: string) => `/org/reports/${id}/versions`, // POST → 새 버전
    aiDraft: (id: string) => `/org/reports/${id}/ai-draft`, // POST {section, memo}
  },
  verify: (no: string) => `/verify/${encodeURIComponent(no)}`, // GET → VerifyResult (기관명·연도·총 가치·발행일만)
  notices: '/notices',
  faqs: '/faqs',
  stats: '/stats',
} as const;
