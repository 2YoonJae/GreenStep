import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { ActivityQuery, Category, Region } from '../data/types';
import { Icon } from '../components/Icon';
import { HeroBanner } from '../components/HeroBanner';
import { ActivityCard, Calculator, Empty, ErrorBox, Loading } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useSaved } from '../lib/saved';
import { useToast } from '../lib/toast';
import { num, won } from '../lib/format';
import { CATEGORY_META, CATEGORIES } from '../lib/sroi';
import { SEED_REGIONS } from '../data/seed';

type Filter = 'all' | 'closing' | Category;

export default function Home() {
  const navigate = useNavigate();
  const notify = useToast();
  const saved = useSaved();
  const [region, setRegion] = useState<Region | ''>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const query: ActivityQuery =
    filter === 'all' ? { sort: 'recommended', pageSize: 6 } : filter === 'closing' ? { sort: 'deadline', closingWithinDays: 7, pageSize: 6 } : { category: filter, sort: 'recommended', pageSize: 6 };
  const list = useAsync(() => api.activities.list(query), [filter]);
  const stats = useAsync(() => api.stats.platform(), []);
  const notices = useAsync(() => api.support.notices(), []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (region) p.set('region', region);
    if (category) p.set('category', category);
    if (keyword.trim()) p.set('q', keyword.trim());
    navigate(`/activities?${p}`);
  };

  const toggleSave = (id: string) => {
    const added = saved.toggle(id);
    notify(added ? '관심 활동에 저장했습니다.' : '관심 활동에서 삭제했습니다.');
  };

  return (
    <>
      <HeroBanner />

      <section className="container search-section" id="activity-search" aria-labelledby="search-heading">
        <div className="search-panel">
          <div className="search-title">
            <Icon name="search" />
            <h2 id="search-heading">어떤 봉사활동을 찾고 있나요?</h2>
            <p>관심 있는 분야부터 시작해 보세요.</p>
          </div>
          <form className="search-form" onSubmit={search}>
            <div className="form-field">
              <label htmlFor="region">지역</label>
              <select id="region" value={region} onChange={(e) => setRegion(e.target.value as Region | '')}>
                <option value="">전체 지역</option>
                {SEED_REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="category">활동 분야</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
                <option value="">전체 분야</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field keyword-field">
              <label htmlFor="keyword">검색어</label>
              <input id="keyword" type="search" placeholder="활동명 또는 기관명을 입력해 주세요" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <button className="button primary search-submit" type="submit">
              <Icon name="search" />
              검색하기
            </button>
          </form>
          <div className="keywords">
            <span>추천 검색어</span>
            {[
              ['멘토링', '#교육 멘토링'],
              ['어르신', '#어르신 돌봄'],
              ['플로깅', '#환경 보호'],
              ['유기동물', '#유기동물'],
            ].map(([k, label]) => (
              <button key={k} type="button" onClick={() => navigate(`/activities?q=${encodeURIComponent(k)}`)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container section" id="activities" aria-labelledby="activities-title">
        <div className="section-heading">
          <div>
            <h2 id="activities-title">함께할 봉사활동을 찾아보세요</h2>
            <p>관심 있는 활동을 선택하고, 참여 일정을 확인하세요.</p>
          </div>
          <Link className="text-button more-link" to="/activities">
            전체 활동 보기
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="filter-row">
          <div className="filters" aria-label="활동 목록 필터">
            {(
              [
                ['all', '추천 활동'],
                ['closing', '마감 임박'],
                ['environment', '생활·환경'],
                ['care', '돌봄·보육'],
                ['education', '교육·멘토링'],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button key={f} className="filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
          <p className="result-meta">
            <strong role="status" aria-live="polite">
              {list.data ? `${list.data.items.length}개의 활동` : ''}
            </strong>{' '}
            · 모집 공고 예시
          </p>
        </div>
        {list.loading && <Loading />}
        {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && (
          <Empty title="조건에 맞는 활동이 없습니다">
            <p>다른 분야를 선택해 주세요.</p>
          </Empty>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="activity-grid">
            {list.data.items.map((a) => (
              <ActivityCard key={a.id} a={a} saved={saved.has(a.id)} onToggleSave={() => toggleSave(a.id)} />
            ))}
          </div>
        )}
        <p className="activity-note">
          <Icon name="info" small />
          활동명·기관·일정은 화면 설명을 위한 예시입니다. 예상 가치는 기획안의 산정 기준을 적용한 값이며, 지급되는 금액이 아닙니다.
        </p>
      </section>

      <section className="process-section" id="guide" aria-labelledby="process-title">
        <div className="container">
          <div className="process-heading">
            <p className="section-label">GREENSTEP 이용 방법</p>
            <h2 id="process-title">활동의 끝이, 이력의 시작이 됩니다</h2>
            <p>신청부터 검증까지, 하나의 흐름으로 함께합니다.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-top">
                <span className="step-number">STEP 01</span>
                <Icon name="search" />
              </div>
              <h3>활동 찾고 신청하기</h3>
              <p>관심 분야와 지역에 맞는<br />봉사활동을 선택합니다.</p>
            </div>
            <div className="step">
              <div className="step-top">
                <span className="step-number">STEP 02</span>
                <Icon name="file" />
              </div>
              <h3>활동 기록 제출하기</h3>
              <p>참여한 날짜와 시간을<br />활동 기록으로 남깁니다.</p>
            </div>
            <div className="step">
              <div className="step-top">
                <span className="step-number">STEP 03</span>
                <Icon name="shield" />
              </div>
              <h3>기관 확인·승인</h3>
              <p>주최 기관이 기록을 확인하고<br />승인 또는 반려합니다.</p>
              <span className="step-tag">
                <Icon name="check" small />
                승인된 기록만 반영
              </span>
            </div>
            <div className="step">
              <div className="step-top">
                <span className="step-number">STEP 04</span>
                <Icon name="chart" />
              </div>
              <h3>가치와 이력으로 남기기</h3>
              <p>사회적 가치로 환산하고<br />이력서·보고서에 반영합니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container section value-section" aria-labelledby="value-title">
        <div className="value-intro">
          <p className="section-label">시간을 넘어, 가치로</p>
          <h2 id="value-title">
            함께한 시간은
            <br />
            얼마의 가치가 될까요?
          </h2>
          <p>GreenStep은 활동 시간과 분야별 단가, 가중치를 바탕으로 사회적 가치를 추정합니다. 같은 기록이 청년의 이력이 되고, 기관의 성과가 됩니다.</p>
          <div className="document-links">
            <Link className="document-link" to="/me/resume">
              <span className="document-icon">
                <Icon name="file" />
              </span>
              <span>
                <strong>청년을 위한 봉사 이력서</strong>
                <small>승인된 활동 시간과 사회적 가치를 한눈에</small>
              </span>
              <Icon name="arrow" />
            </Link>
            <Link className="document-link" to="/org/reports">
              <span className="document-icon">
                <Icon name="chart" />
              </span>
              <span>
                <strong>기관을 위한 ESG 경영 보고서</strong>
                <small>활동 성과를 모아 CSV·PDF로 제공</small>
              </span>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <Calculator />
      </section>

      <section className="container impact" aria-labelledby="impact-title">
        <div className="impact-heading">
          <h2 id="impact-title">승인된 활동으로 쌓이는 우리의 성과</h2>
          <span>플랫폼 현황 · 기관 승인 기록 기준</span>
        </div>
        <div className="impact-grid">
          <div className="impact-item">
            <p>참여 청년</p>
            <strong>
              {stats.data ? num(stats.data.youthCount) : '—'}
              <small>명</small>
            </strong>
          </div>
          <div className="impact-item">
            <p>함께하는 기관</p>
            <strong>
              {stats.data ? num(stats.data.orgCount) : '—'}
              <small>곳</small>
            </strong>
          </div>
          <div className="impact-item">
            <p>인증 활동 시간</p>
            <strong>
              {stats.data ? num(stats.data.totalHours) : '—'}
              <small>시간</small>
            </strong>
          </div>
          <div className="impact-item">
            <p>누적 사회적 가치</p>
            <strong>
              {stats.data ? won(stats.data.totalValue) : '—'}
              <small>원</small>
            </strong>
          </div>
        </div>
        <p className="impact-note">기관이 승인(APPROVED)한 기록만 집계합니다. {api.mode === 'mock' ? '현재 수치는 데모 데이터 기준입니다.' : ''}</p>
      </section>

      <section className="support-strip" id="support" aria-label="공지사항과 고객지원">
        <div className="container support-inner">
          <div className="notice">
            <strong>공지사항</strong>
            {notices.data?.slice(0, 1).map((n) => (
              <Link key={n.id} to={`/support?tab=notice&id=${n.id}`} className="text-body hover:underline">
                {n.title}
              </Link>
            ))}
          </div>
          <Link className="text-button support-link" to="/support?tab=guide">
            처음 이용하시나요? 이용 방법 보기
            <Icon name="arrow" small />
          </Link>
        </div>
      </section>
    </>
  );
}
