import type { Api } from '../types';
import type { Session } from '../../data/types';
import { EP } from '../endpoints';
import { http, setAccessToken } from './client';

const keep = (s: Session) => {
  setAccessToken(s.accessToken);
  return s;
};

/** 실제 백엔드(FastAPI) 구현. VITE_API_MODE=http 일 때 사용 */
export const httpApi: Api = {
  mode: 'http',

  auth: {
    loginYouth: (email, password) => http.post<Session>(EP.auth.youthLogin, { email, password }).then(keep),
    loginOrg: (email, password) => http.post<Session>(EP.auth.orgLogin, { email, password }).then(keep),
    signupYouth: (input) => http.post<Session>(EP.auth.youthSignup, input).then(keep),
    signupOrg: (input) => http.post<Session>(EP.auth.orgSignup, input).then(keep),
    restore: () =>
      http
        .post<Session>(EP.auth.refresh)
        .then(keep)
        .catch(() => null),
    logout: async () => {
      await http.post<void>(EP.auth.logout).catch(() => undefined);
      setAccessToken(null);
    },
  },

  activities: {
    list: (q) => http.get(EP.activities, { ...q, closing: q.closingWithinDays }),
    get: (id) => http.get(EP.activity(id)),
  },

  applications: {
    mine: () => http.get(EP.me.applications),
    apply: (id) => http.post(EP.applications(id)),
    cancel: (id) => http.del(EP.applications(id)),
  },

  participations: {
    mine: () => http.get(EP.me.participations),
    submit: (input) => http.post(EP.me.participations, input),
    submitExternal: ({ certificate, ...rest }) => {
      const form = new FormData();
      Object.entries(rest).forEach(([k, v]) => form.append(k, String(v)));
      if (certificate) form.append('certificate', certificate);
      return http.form(EP.me.external, form);
    },
  },

  resume: {
    latest: () => http.get(EP.me.resume),
    issue: () => http.post(EP.me.resume),
  },

  me: {
    update: (input) => http.patch(EP.me.profile, input),
  },

  org: {
    me: () => http.get(EP.org.me),
    dashboard: () => http.get(EP.org.dashboard),
    activities: () => http.get(EP.org.activities),
    activity: (id) => http.get(EP.org.activity(id)),
    createActivity: (input) => http.post(EP.org.activities, input),
    updateActivity: (id, input) => http.put(EP.org.activity(id), input),
    setActivityStatus: (id, status) => http.patch(EP.org.activityStatus(id), { status }),
    deleteActivity: (id) => http.del(EP.org.activity(id)),
    participations: (status) => http.get(EP.org.participations, { status }),
    approve: (id) => http.post(EP.org.approve(id)),
    reject: (id, reason) => http.post(EP.org.reject(id), { reason }),
    demoApproveReview: () => http.post(EP.org.demoApprove),
  },

  reports: {
    summary: (year) => http.get(EP.reports.summary, { year }),
    list: () => http.get(EP.reports.list),
    create: (year) => http.post(EP.reports.list, { year }),
    update: (id, patch) => http.patch(EP.reports.item(id), patch),
    markPaid: (id) => http.post(EP.reports.pay(id)),
    publish: (id) => http.post(EP.reports.publish(id)),
    newVersion: (id) => http.post(EP.reports.version(id)),
    aiDraft: (id, section, memo) => http.post(EP.reports.aiDraft(id), { section, memo }),
  },

  verify: {
    lookup: (no) => http.get(EP.verify(no)),
  },

  support: {
    notices: () => http.get(EP.notices),
    faqs: () => http.get(EP.faqs),
  },

  stats: {
    platform: () => http.get(EP.stats),
  },
};
