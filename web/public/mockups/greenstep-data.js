/*
 * GreenStep 문서 목업용 예시 데이터
 * ─────────────────────────────────────────────────────────────────────────────
 * 봉사 이력서 · ESG 경영 보고서 디자인 목업(홈 화면 "함께한 시간은 얼마의 가치가 될까요?")에서 사용합니다.
 * 테이블과 컬럼 이름은 GreenStep DB(backend/alembic/versions/0001_initial_schema.sql)와 같습니다.
 * 수치는 모두 임의로 정한 예시이며, 실제 기관·인물과 관계없습니다.
 *
 *   organizations · organization_profiles · users · user_profiles · activities · activity_details
 *   participations · record_attributions · verification_logs · valuation_rules · social_value_calculations
 *
 * 문서 수치는 아래 행들에서 집계합니다 (기관 승인 APPROVED 기록만 반영, 단가·가중치는 제출 시점 스냅샷).
 */
(function () {
  'use strict';

  // ───────── 산정 기준 ─────────
  var BASE_RATE = 10320; // 2026 최저임금
  var CARE_RATE = 11120; // 돌봄·보육
  var CATEGORY = {
    education: { label: '교육·멘토링', rate: BASE_RATE },
    care: { label: '돌봄·보육', rate: CARE_RATE },
    environment: { label: '생활·환경', rate: BASE_RATE },
    health: { label: '보건·의료', rate: BASE_RATE },
  };
  var ORG_TYPE = {
    WELFARE_CENTER: '종합사회복지관', WELFARE_FACILITY: '복지시설', NONPROFIT: '비영리단체', PUBLIC: '공공기관', COMPANY: '기업', OTHER: '기타',
  };

  var valuation_rules = [{ rule_id: 'vr-2026', version: '2026.1', maximum_weight: 1.5 }];

  // ───────── 기관 ─────────
  var organizations = [
    { organization_id: 'o1', name: '성남 이웃돌봄복지관', organization_type: 'WELFARE_CENTER', verification_status: 'APPROVED', address: '경기 성남시 수정구 이웃로 12', contact_email: 'contact@demo.kr', created_at: '2026-01-05T09:00:00+09:00', business_no: '1298210001', business_api_key: 'GS-DEMO-0001' },
    { organization_id: 'o2', name: '마포 청년배움센터', organization_type: 'NONPROFIT', verification_status: 'APPROVED', address: '서울 마포구 배움길 34', contact_email: 'mapo@demo.kr', created_at: '2026-01-05T09:00:00+09:00', business_no: '1058210002', business_api_key: 'GS-DEMO-0002' },
    { organization_id: 'o3', name: '우리동네 환경모임', organization_type: 'NONPROFIT', verification_status: 'APPROVED', address: '서울 성동구 하천로 8', contact_email: 'eco@demo.kr', created_at: '2026-01-05T09:00:00+09:00', business_no: '2068210003', business_api_key: 'GS-DEMO-0003' },
  ];
  var organization_profiles = [
    { organization_id: 'o1', intro: '성남 지역 어르신과 아동을 위한 돌봄·여가 프로그램을 운영하는 종합사회복지관입니다. 2026년에는 GreenStep으로 청년 봉사자 모집과 활동 기록 승인을 한곳에서 관리했습니다.', weight_shortage: false, weight_difficulty: true, weight_vulnerable: false },
    { organization_id: 'o2', intro: '지역 아동·청소년의 학습을 지원하는 비영리 교육기관입니다.', weight_shortage: false, weight_difficulty: false, weight_vulnerable: false },
    { organization_id: 'o3', intro: '하천·공원 정화 활동을 하는 주민 환경단체입니다.', weight_shortage: false, weight_difficulty: false, weight_vulnerable: false },
  ];

  // ───────── 공고 + 상세 (weight 는 운영자 확인(CONFIRMED) 된 것만 1.0 초과) ─────────
  var activities = [
    { activity_id: 'a1', organization_id: 'o1', source_type: 'GREENSTEP', title: '방과후 아동 1:1 돌봄 교실', category: 'care', region_name: '경기 성남시', address: '경기 성남시 수정구 이웃로 12, 2층 아동돌봄실', description: '평일 오후 아동 한 명을 맡아 숙제 지도와 정서 지원을 합니다.', activity_start_date: '2026-01-07', activity_end_date: '2026-11-30', capacity: 12, status: 'RECRUITING' },
    { activity_id: 'a2', organization_id: 'o1', source_type: 'GREENSTEP', title: '어르신과 나누는 따뜻한 일상', category: 'care', region_name: '경기 성남시', address: '경기 성남시 수정구 이웃로 12, 프로그램실', description: '어르신 여가 프로그램(만들기·노래교실) 준비와 진행을 돕습니다.', activity_start_date: '2026-02-03', activity_end_date: '2026-11-30', capacity: 10, status: 'RECRUITING' },
    { activity_id: 'a3', organization_id: 'o1', source_type: 'GREENSTEP', title: '홀몸 어르신 안부 방문과 건강 체크', category: 'health', region_name: '경기 성남시', address: '경기 성남시 수정구 일대 (복지관 재가복지팀 출발)', description: '홀몸 어르신 가정을 방문해 혈압·컨디션을 기록하고 복약 시간을 안내합니다.', activity_start_date: '2026-03-07', activity_end_date: '2026-11-30', capacity: 8, status: 'RECRUITING' },
    { activity_id: 'a4', organization_id: 'o1', source_type: 'GREENSTEP', title: '중학생 기초학력 멘토링', category: 'education', region_name: '경기 성남시', address: '경기 성남시 수정구 이웃로 12, 3층 배움터', description: '기초학력이 부족한 중학생의 국어·수학 숙제를 함께 봅니다.', activity_start_date: '2026-03-03', activity_end_date: '2026-12-15', capacity: 10, status: 'RECRUITING' },
    { activity_id: 'a5', organization_id: 'o1', source_type: 'GREENSTEP', title: '복지관 주변 골목 환경 정화', category: 'environment', region_name: '경기 성남시', address: '경기 성남시 수정구 이웃로 일대', description: '복지관 주변 골목과 공원의 쓰레기를 줍고 분리배출 캠페인을 합니다.', activity_start_date: '2026-04-04', activity_end_date: '2026-11-28', capacity: 20, status: 'RECRUITING' },
    { activity_id: 'a6', organization_id: 'o1', source_type: 'GREENSTEP', title: '발달장애 아동 놀이 활동 지원', category: 'care', region_name: '경기 성남시', address: '경기 성남시 수정구 이웃로 12, 감각놀이실', description: '발달장애 아동 한 명과 짝을 이뤄 놀이 프로그램에 함께 참여합니다.', activity_start_date: '2026-05-06', activity_end_date: '2026-11-30', capacity: 6, status: 'RECRUITING' },
    { activity_id: 'a7', organization_id: 'o2', source_type: 'GREENSTEP', title: '중학생 수학 학습 멘토링', category: 'education', region_name: '서울 마포구', address: '서울 마포구 배움길 34, 2층 학습실', description: '중학생 2~3명과 소그룹으로 수학 개념과 숙제를 함께 봅니다.', activity_start_date: '2026-03-03', activity_end_date: '2026-07-31', capacity: 10, status: 'CLOSED' },
    { activity_id: 'a8', organization_id: 'o3', source_type: 'GREENSTEP', title: '중랑천 정화와 생태 모니터링', category: 'environment', region_name: '서울 성동구', address: '서울 성동구 하천로 8, 중랑천 산책로 일대', description: '하천 쓰레기를 줍고 구간별 생태 관찰 기록지를 작성합니다.', activity_start_date: '2026-04-11', activity_end_date: '2026-10-31', capacity: 25, status: 'CLOSED' },
  ];
  var activity_details = [
    { activity_id: 'a1', summary: '맞벌이 가정 아동과 1:1로 숙제와 놀이를 함께합니다.', hours_per_session: 3.0, target_group: '초등 저학년 아동', tasks: '1:1 돌봄, 숙제 지도, 정서 지원', individual_support: true, difficulty_reason: '아동 대상 1:1 개별 지원', weight: 1.2, weight_status: 'CONFIRMED', weight_difficulty: true },
    { activity_id: 'a2', summary: '복지관 프로그램실에서 어르신들과 여가 활동을 함께합니다.', hours_per_session: 3.0, target_group: '지역 어르신', tasks: '여가 프로그램 진행 보조, 말벗', individual_support: false, difficulty_reason: null, weight: 1.0, weight_status: 'NONE', weight_difficulty: false },
    { activity_id: 'a3', summary: '홀몸 어르신 가정을 방문해 안부와 건강 상태를 확인합니다.', hours_per_session: 2.5, target_group: '홀몸 어르신', tasks: '가정 방문, 혈압·컨디션 기록, 복약 안내', individual_support: true, difficulty_reason: '어르신 대상 1:1 방문 지원', weight: 1.2, weight_status: 'CONFIRMED', weight_difficulty: true },
    { activity_id: 'a4', summary: '중학생의 국어·수학 숙제를 함께 보며 학습 습관을 잡아 줍니다.', hours_per_session: 2.0, target_group: '중학생', tasks: '학습 멘토링, 숙제 지도', individual_support: false, difficulty_reason: null, weight: 1.0, weight_status: 'NONE', weight_difficulty: false },
    { activity_id: 'a5', summary: '복지관 주변 골목과 공원을 정화합니다.', hours_per_session: 2.0, target_group: '지역 주민', tasks: '쓰레기 수거, 분리배출 캠페인', individual_support: false, difficulty_reason: null, weight: 1.0, weight_status: 'NONE', weight_difficulty: false },
    { activity_id: 'a6', summary: '발달장애 아동과 짝을 이뤄 놀이 프로그램에 참여합니다.', hours_per_session: 3.0, target_group: '발달장애 아동', tasks: '1:1 놀이 지원, 이동 보조', individual_support: true, difficulty_reason: '장애 아동 대상 1:1 개별 지원', weight: 1.2, weight_status: 'CONFIRMED', weight_difficulty: true },
    { activity_id: 'a7', summary: '중학생과 소그룹으로 수학 개념을 복습합니다.', hours_per_session: 2.0, target_group: '중학생', tasks: '소그룹 학습 멘토링, 오답 정리', individual_support: false, difficulty_reason: null, weight: 1.0, weight_status: 'NONE', weight_difficulty: false },
    { activity_id: 'a8', summary: '하천 쓰레기를 줍고 생태 관찰 기록을 남깁니다.', hours_per_session: 3.0, target_group: '지역 하천', tasks: '하천 정화, 생태 관찰 기록', individual_support: false, difficulty_reason: null, weight: 1.0, weight_status: 'NONE', weight_difficulty: false },
  ];

  // ───────── 회원 ─────────
  var users = [{ user_id: 'u1', email: 'youth@demo.kr', name: '김지원', account_status: 'ACTIVE', created_at: '2026-02-20T10:00:00+09:00' }];
  var user_profiles = [{ user_id: 'u1', school: '한국대학교 사회복지학과', target_field: '복지관', marketing_consent: false }];
  // 보고서 집계용 다른 청년 회원 47명 (이름은 문서에 싣지 않음 — 인원수만 표시)
  for (var n = 2; n <= 48; n++) {
    var id = 'u' + n;
    users.push({ user_id: id, email: 'youth' + n + '@demo.kr', name: '청년회원' + n, account_status: 'ACTIVE', created_at: '2026-01-10T10:00:00+09:00' });
    user_profiles.push({ user_id: id, school: '', target_field: '', marketing_consent: false });
  }

  // ───────── 활동 실적 ─────────
  var participations = [];
  var seq = 0;
  function pad(v) { return (v < 10 ? '0' : '') + v; }
  function addHours(iso, h) {
    var d = new Date(iso);
    d.setMinutes(d.getMinutes() + Math.round(h * 60));
    return d.toISOString();
  }
  function record(userId, activityId, date, status) {
    var det = find(activity_details, 'activity_id', activityId);
    var start = date + 'T14:00:00+09:00';
    var decidedAt = new Date(new Date(start).getTime() + 2 * 86400000).toISOString();
    seq += 1;
    participations.push({
      participation_id: 'p' + seq, user_id: userId, activity_id: activityId, application_id: null,
      started_at: start, ended_at: addHours(start, det.hours_per_session),
      approved_minutes: status === 'APPROVED' ? Math.round(det.hours_per_session * 60) : null,
      record_source: 'GREENSTEP', status: status, verification_method: 'ORG_APPROVAL',
      verification_status: status === 'APPROVED' ? 'VERIFIED' : status === 'REJECTED' ? 'FAILED' : 'PENDING',
      approved_at: status === 'APPROVED' ? decidedAt : null,
    });
  }

  // 김지원(u1)의 기록 — 봉사 이력서에 쓰임
  function weekly(userId, activityId, first, count, everyDays, rejectedIdx) {
    var d = new Date(first + 'T00:00:00+09:00');
    for (var i = 0; i < count; i++) {
      var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      record(userId, activityId, day, rejectedIdx === i ? 'REJECTED' : 'APPROVED');
      d.setDate(d.getDate() + everyDays);
    }
  }
  weekly('u1', 'a1', '2026-03-04', 16, 7, -1); // 매주 수요일 16회
  weekly('u1', 'a7', '2026-03-10', 12, 7, -1); // 매주 화요일 12회
  weekly('u1', 'a8', '2026-04-11', 7, 28, 6); // 4주마다 토요일 7회 (마지막 1회 반려 — 활동일 불일치)
  weekly('u1', 'a3', '2026-07-04', 10, 14, -1); // 격주 토요일 10회
  record('u1', 'a1', '2026-11-18', 'PENDING'); // 승인 대기 — 문서에 반영 안 됨

  // 성남 이웃돌봄복지관(o1) 활동의 다른 청년 기록 — 결정적 난수로 생성 (새로고침해도 같은 값)
  var rnd = (function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(20261125);
  var TEAMS = { a1: [2, 13], a2: [14, 23], a3: [24, 30], a4: [31, 39], a5: [40, 48], a6: [5, 10] };
  ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].forEach(function (aid, ai) {
    var act = find(activities, 'activity_id', aid);
    var startMonth = Number(act.activity_start_date.slice(5, 7));
    var team = TEAMS[aid];
    for (var m = startMonth; m <= 11; m++) {
      var sessions = aid === 'a5' ? 2 : 4;
      for (var s = 0; s < sessions; s++) {
        var day = Math.min(28, 2 + ai + s * 7);
        var date = '2026-' + pad(m) + '-' + pad(day);
        var people = 2 + Math.floor(rnd() * (aid === 'a5' ? 6 : 3));
        for (var k = 0; k < people; k++) {
          var uid = 'u' + (team[0] + Math.floor(rnd() * (team[1] - team[0] + 1)));
          var r = rnd();
          var status = m === 11 && s >= 3 ? 'PENDING' : r < 0.035 ? 'REJECTED' : 'APPROVED';
          record(uid, aid, date, status);
        }
      }
    }
  });

  // 기록의 기관 귀속 · 검증 이력
  var record_attributions = participations.map(function (p, i) {
    var act = find(activities, 'activity_id', p.activity_id);
    return {
      attribution_id: 'ra' + (i + 1), participation_id: p.participation_id, organization_id: act.organization_id,
      attribution_status: p.status === 'DRAFT' ? 'PENDING' : p.status, attribution_basis: '담당자 승인', confirmed_at: p.approved_at,
    };
  });
  var verification_logs = participations
    .filter(function (p) { return p.status === 'APPROVED' || p.status === 'REJECTED'; })
    .map(function (p, i) {
      return { verification_id: 'vl' + (i + 1), participation_id: p.participation_id, verifier_type: 'ORG_MANAGER', result: p.status === 'APPROVED' ? 'SUCCESS' : 'FAILED', verified_at: p.approved_at || p.ended_at };
    });

  // 사회적 가치 계산 = 승인 시간 × 표준 단가 × 기관 가중치 (제출 시점 스냅샷)
  var social_value_calculations = participations
    .filter(function (p) { return p.status === 'APPROVED'; })
    .map(function (p, i) {
      var act = find(activities, 'activity_id', p.activity_id);
      var det = find(activity_details, 'activity_id', p.activity_id);
      var rate = CATEGORY[act.category].rate;
      var weight = det.weight_status === 'CONFIRMED' ? det.weight : 1.0;
      return {
        calculation_id: 'sv' + (i + 1), participation_id: p.participation_id, rule_id: 'vr-2026',
        hourly_rate_snapshot: rate, weight_snapshot: weight,
        estimated_value_krw: Math.round((p.approved_minutes / 60) * rate * weight), calculated_at: p.approved_at,
      };
    });

  // ESG 경영 보고서 본문 (웹의 보고서 편집기 항목: 인사말 · 기관 소개 · 주요 활동 · 내년 계획)
  var report_sections = {
    o1: {
      greeting: '안녕하십니까. {기관명}입니다.\n{연도}년 한 해 동안 지역 청년 {참여청년}이 저희 기관과 함께 {총시간}의 봉사활동에 참여해 주셨습니다. 이를 사회적 가치로 환산하면 {총가치}에 이릅니다.\n청년들의 시간은 아이들의 방과후와 어르신들의 일상을 지키는 힘이 되었습니다. 함께해 주신 모든 청년 봉사자께 깊이 감사드립니다.',
      highlights: '방과후 아동 1:1 돌봄 교실을 연중 운영했고, 홀몸 어르신 안부 방문을 3월부터 정례화했습니다. 발달장애 아동 놀이 지원을 새로 열어 직무 난이도 가중 활동을 넓혔습니다.',
      plan: [
        ['2027 상반기', '아동 1:1 돌봄 정원 12명 → 16명 확대'],
        ['2027 하반기', '홀몸 어르신 방문 대상 가구 2배 확대'],
        ['2028', '청년 봉사자 대상 돌봄 기초 교육 정례화'],
        ['계속', '승인 기록 기반 ESG 경영 보고서 연 1회 발행'],
      ],
    },
  };

  // ───────── 집계 도우미 ─────────
  function find(rows, key, val) {
    for (var i = 0; i < rows.length; i++) if (rows[i][key] === val) return rows[i];
    return null;
  }
  function svcOf(pid) { return find(social_value_calculations, 'participation_id', pid); }
  function hoursOf(p) { return p.approved_minutes / 60; }
  function dateOf(iso) { return iso.slice(0, 10); }

  /** 봉사 이력서 — 기관 승인(APPROVED) 기록만 */
  function resume(userId) {
    var user = find(users, 'user_id', userId);
    var profile = find(user_profiles, 'user_id', userId);
    var mine = participations.filter(function (p) { return p.user_id === userId; });
    var approved = mine.filter(function (p) { return p.status === 'APPROVED'; });
    var rejected = mine.filter(function (p) { return p.status === 'REJECTED'; });
    var byAct = {};
    approved.forEach(function (p) {
      var g = byAct[p.activity_id] || (byAct[p.activity_id] = { rows: [] });
      g.rows.push(p);
    });
    var acts = Object.keys(byAct).map(function (aid) {
      var rows = byAct[aid].rows.slice().sort(function (a, b) { return a.started_at < b.started_at ? -1 : 1; });
      var act = find(activities, 'activity_id', aid);
      var det = find(activity_details, 'activity_id', aid);
      var org = find(organizations, 'organization_id', act.organization_id);
      var hours = 0, value = 0, lastApproved = '';
      rows.forEach(function (p) {
        hours += hoursOf(p);
        value += svcOf(p.participation_id).estimated_value_krw;
        if (p.approved_at > lastApproved) lastApproved = p.approved_at;
      });
      var svc = svcOf(rows[0].participation_id);
      return {
        activity: act, details: det, org: org, orgTypeLabel: ORG_TYPE[org.organization_type], categoryLabel: CATEGORY[act.category].label,
        sessions: rows.length, hours: hours, value: value, rate: svc.hourly_rate_snapshot, weight: svc.weight_snapshot,
        first: dateOf(rows[0].started_at), last: dateOf(rows[rows.length - 1].started_at), lastApproved: dateOf(lastApproved),
      };
    }).sort(function (a, b) { return a.first < b.first ? -1 : 1; });

    var totalHours = acts.reduce(function (s, a) { return s + a.hours; }, 0);
    var totalValue = acts.reduce(function (s, a) { return s + a.value; }, 0);
    var weightedHours = acts.reduce(function (s, a) { return s + (a.weight > 1 ? a.hours : 0); }, 0);
    var byCategory = Object.keys(CATEGORY).map(function (c) {
      var h = acts.filter(function (a) { return a.activity.category === c; }).reduce(function (s, a) { return s + a.hours; }, 0);
      return { category: c, label: CATEGORY[c].label, hours: h, share: totalHours ? h / totalHours : 0 };
    });
    var first = acts.reduce(function (m, a) { return a.first < m ? a.first : m; }, '9999');
    var last = acts.reduce(function (m, a) { return a.last > m ? a.last : m; }, '0000');
    return {
      user: user, profile: profile, activities: acts, totalHours: totalHours, totalValue: totalValue,
      sessions: approved.length, orgCount: new Set(acts.map(function (a) { return a.org.organization_id; })).size,
      weightedShare: totalHours ? weightedHours / totalHours : 0,
      approvalRate: approved.length / (approved.length + rejected.length), rejectedCount: rejected.length,
      pendingCount: mine.filter(function (p) { return p.status === 'PENDING'; }).length,
      byCategory: byCategory, first: first, last: last,
      confirmNo: 'GSR-2026-0001-K8TZ', issuedAt: '2026-11-25',
    };
  }

  /** ESG 경영 보고서 — 해당 기관 활동의 기관 승인 기록만 */
  function report(orgId, year) {
    var org = find(organizations, 'organization_id', orgId);
    var profile = find(organization_profiles, 'organization_id', orgId);
    var orgActs = activities.filter(function (a) { return a.organization_id === orgId; });
    var ids = orgActs.map(function (a) { return a.activity_id; });
    var rows = participations.filter(function (p) { return ids.indexOf(p.activity_id) >= 0 && p.started_at.slice(0, 4) === String(year); });
    var approved = rows.filter(function (p) { return p.status === 'APPROVED'; });
    var rejected = rows.filter(function (p) { return p.status === 'REJECTED'; });
    var pending = rows.filter(function (p) { return p.status === 'PENDING'; });
    var totalHours = 0, totalValue = 0, weightedHours = 0;
    var youth = new Set();
    var monthly = [];
    for (var m = 1; m <= 12; m++) monthly.push({ month: m, records: 0, hours: 0, value: 0, youth: new Set() });
    var byAct = {};
    approved.forEach(function (p) {
      var h = hoursOf(p), svc = svcOf(p.participation_id), v = svc.estimated_value_krw;
      totalHours += h; totalValue += v; youth.add(p.user_id);
      if (svc.weight_snapshot > 1) weightedHours += h;
      var mo = monthly[Number(p.started_at.slice(5, 7)) - 1];
      mo.records++; mo.hours += h; mo.value += v; mo.youth.add(p.user_id);
      var g = byAct[p.activity_id] || (byAct[p.activity_id] = { hours: 0, value: 0, youth: new Set(), records: 0 });
      g.hours += h; g.value += v; g.youth.add(p.user_id); g.records++;
    });
    monthly.forEach(function (mo) { mo.youth = mo.youth.size; });
    var byActivity = orgActs.filter(function (a) { return byAct[a.activity_id]; }).map(function (a) {
      var g = byAct[a.activity_id];
      var det = find(activity_details, 'activity_id', a.activity_id);
      return { title: a.title, category: a.category, categoryLabel: CATEGORY[a.category].label, weight: det.weight_status === 'CONFIRMED' ? det.weight : 1, youth: g.youth.size, records: g.records, hours: g.hours, value: g.value };
    }).sort(function (a, b) { return b.value - a.value; });
    var byCategory = Object.keys(CATEGORY).map(function (c) {
      var v = byActivity.filter(function (a) { return a.category === c; }).reduce(function (s, a) { return s + a.value; }, 0);
      return { category: c, label: CATEGORY[c].label, value: v, share: totalValue ? v / totalValue : 0 };
    }).filter(function (c) { return c.value > 0; }).sort(function (a, b) { return b.value - a.value; });

    var sections = report_sections[orgId];
    var fill = function (t) {
      return t.replace(/\{기관명\}/g, org.name).replace(/\{연도\}/g, String(year))
        .replace(/\{참여청년\}/g, fmt.num(youth.size) + '명').replace(/\{총시간\}/g, fmt.num(totalHours) + '시간')
        .replace(/\{총가치\}/g, fmt.won(totalValue) + '원');
    };
    return {
      org: org, profile: profile, orgTypeLabel: ORG_TYPE[org.organization_type], year: year,
      totalHours: totalHours, totalValue: totalValue, youthCount: youth.size, activityCount: byActivity.length,
      approvedCount: approved.length, rejectedCount: rejected.length, pendingCount: pending.length,
      approvalRate: approved.length / (approved.length + rejected.length),
      avgHoursPerYouth: youth.size ? totalHours / youth.size : 0, weightedShare: totalHours ? weightedHours / totalHours : 0,
      monthly: monthly.slice(0, 11), byActivity: byActivity, byCategory: byCategory,
      greeting: fill(sections.greeting), highlights: fill(sections.highlights), plan: sections.plan,
      confirmNo: 'GS-2026-0001-7Q4M', period: '2026.01 ~ 2026.11', generatedAt: '2026.11.25',
    };
  }

  var fmt = {
    num: function (v) { return (Math.round(v * 10) / 10).toLocaleString('ko-KR'); },
    won: function (v) { return Math.round(v).toLocaleString('ko-KR'); },
    man: function (v) { return Math.round(v / 10000).toLocaleString('ko-KR'); }, // 만원 단위
    pct: function (v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; },
    dot: function (iso) { return iso.slice(0, 10).replace(/-/g, '.'); },
  };

  window.GreenStepMock = {
    tables: {
      valuation_rules: valuation_rules, organizations: organizations, organization_profiles: organization_profiles,
      users: users, user_profiles: user_profiles, activities: activities, activity_details: activity_details,
      participations: participations, record_attributions: record_attributions, verification_logs: verification_logs,
      social_value_calculations: social_value_calculations,
    },
    rates: { base: BASE_RATE, care: CARE_RATE },
    resume: resume,
    report: report,
    fmt: fmt,
  };
})();
