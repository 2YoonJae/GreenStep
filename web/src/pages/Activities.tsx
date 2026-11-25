import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { ActivitySort, ActivitySource, Category, Region } from '../data/types';
import { SubPage } from '../components/SubPage';
import { Icon } from '../components/Icon';
import { ActivityCard, Empty, ErrorBox, Loading } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useSaved } from '../lib/saved';
import { useToast } from '../lib/toast';
import { CATEGORY_META, CATEGORIES } from '../lib/sroi';
import { REGIONS } from '../data/types';

const SORTS: [ActivitySort, string][] = [
  ['recommended', '추천순'],
  ['popular', '인기순'],
  ['deadline', '마감 임박순'],
  ['value', '예상 가치 높은 순'],
  ['latest', '최신 등록순'],
];
const PAGE_SIZE = 9;

export default function Activities() {
  const [params, setParams] = useSearchParams();
  const notify = useToast();
  const saved = useSaved();

  const q = params.get('q') ?? '';
  const region = (params.get('region') ?? '') as Region | '';
  const category = (params.get('category') ?? '') as Category | '';
  const source = (params.get('source') ?? '') as ActivitySource | '';
  const sort = (params.get('sort') ?? 'recommended') as ActivitySort;
  const bonus = params.get('bonus') === '1';
  const closing = params.get('closing') ? Number(params.get('closing')) : undefined;
  const page = Number(params.get('page') ?? 1);

  const [keyword, setKeyword] = useState(q);
  useEffect(() => {
    setKeyword(q);
  }, [q]);

  const list = useAsync(
    () => api.activities.list({ q, region, category, source, sort, bonus, closingWithinDays: closing, page, pageSize: PAGE_SIZE }),
    [q, region, category, source, sort, bonus, closing, page],
  );

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    set({ q: keyword.trim() || null });
  };

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;
  const title = closing ? '마감 임박 활동' : sort === 'popular' ? '인기 활동' : category ? `${CATEGORY_META[category].label} 활동` : '봉사활동 찾기';

  return (
    <SubPage section="activities" title={title} desc="키워드·분야·지역으로 활동을 찾고, 예상 사회적 가치를 확인하세요.">
      <form className="panel mb-6" onSubmit={submit}>
        <div className="grid gap-4" style={{ gridTemplateColumns: '160px 180px 1fr 180px 120px', alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="f-region">지역</label>
            <select id="f-region" value={region} onChange={(e) => set({ region: e.target.value || null })}>
              <option value="">전체 지역</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-category">활동 분야</label>
            <select id="f-category" value={category} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">전체 분야</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-q">검색어</label>
            <input id="f-q" type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="활동명, 기관명, 지역, 업무" />
          </div>
          <div className="field">
            <label htmlFor="f-sort">정렬</label>
            <select id="f-sort" value={sort} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" style={{ minHeight: 48 }} type="submit">
            <Icon name="search" />
            검색
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="check">
            <input type="checkbox" checked={bonus} onChange={(e) => set({ bonus: e.target.checked ? '1' : null })} />
            가산 조건 활동만 (직무 난이도 가중치 적용·후보)
          </label>
          <label className="check">
            <input type="checkbox" checked={closing !== undefined} onChange={(e) => set({ closing: e.target.checked ? '7' : null })} />
            7일 안에 마감
          </label>
          {(q || region || category || source || bonus || closing !== undefined || sort !== 'recommended') && (
            <button type="button" className="text-button text-sm text-hover" onClick={() => setParams(new URLSearchParams())}>
              조건 초기화
            </button>
          )}
        </div>
      </form>

      <div className="filter-row">
        <div className="filters" role="group" aria-label="공고 출처">
          {(
            [
              ['', '전체 공고'],
              ['GREENSTEP', 'GreenStep 공고'],
              ['1365', '1365 공고'],
            ] as [ActivitySource | '', string][]
          ).map(([v, l]) => (
            <button key={l} type="button" className="filter" aria-pressed={source === v} onClick={() => set({ source: v || null })}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-[15px] text-muted">
          {list.data && (
            <>
              <strong className="text-ink">{list.data.total}개</strong>의 모집 중 활동
            </>
          )}
        </p>
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length === 0 && (
        <Empty title="조건에 맞는 활동이 없습니다">
          <p>다른 검색어를 입력하거나 지역·분야 조건을 변경해 주세요.</p>
          <button className="button" onClick={() => setParams(new URLSearchParams())}>
            검색 조건 초기화
          </button>
        </Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="activity-grid">
          {list.data.items.map((a) => (
            <ActivityCard
              key={a.id}
              a={a}
              saved={saved.has(a.id)}
              onToggleSave={() => notify(saved.toggle(a.id) ? '관심 활동에 저장했습니다.' : '관심 활동에서 삭제했습니다.')}
            />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-8 flex justify-center gap-2" aria-label="페이지">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} className={`button small ${n === page ? 'primary' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => set({ page: String(n) })}>
              {n}
            </button>
          ))}
        </nav>
      )}
      <p className="activity-note">
        <Icon name="info" small />
        예상 가치는 활동 1회 기준 추정값입니다. 실제 반영은 기록 제출 시점 단가·가중치로 고정되고, 기관 승인 후 이루어집니다.
      </p>
      <p className="activity-note">
        <Icon name="info" small />
        1365 공고 출처: 행정안전부 1365 자원봉사포털 (공공데이터포털 「행정안전부_봉사참여정보서비스」). 2시간마다 갱신되며, 신청은 1365 원문에서 합니다.
      </p>
    </SubPage>
  );
}
