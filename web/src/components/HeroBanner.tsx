import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

interface Slide {
  image: string;
  alt: string;
  eyebrow: string;
  title: [string, string]; // 두 줄, 둘째 줄의 강조 단어는 highlight
  highlight: string;
  desc: string;
  cta: { label: string; to: string };
  steps?: string[];
}

const SLIDES: Slide[] = [
  {
    image: '/images/hero.png',
    alt: '공원에서 함께 봉사활동을 준비하는 청년들',
    eyebrow: '함께하는 봉사, 남겨지는 가치',
    title: ['당신의 작은 실천이', '사회적 가치로 남습니다'],
    highlight: '사회적 가치',
    desc: '나에게 맞는 봉사를 찾고, 함께한 시간을 기록하세요. 검증된 활동은 사회적 가치와 봉사 이력서로 이어집니다.',
    cta: { label: '나에게 맞는 봉사활동 찾기', to: '/activities' },
    steps: ['활동 신청', '기록 제출', '기관 검증'],
  },
  {
    image: '/images/education.png',
    alt: '아이와 함께 책을 읽으며 학습을 돕는 청년 멘토',
    eyebrow: '청년을 위한 봉사 이력서',
    title: ['기관이 승인한 활동 시간이', '봉사 이력서가 됩니다'],
    highlight: '봉사 이력서',
    desc: '승인된 활동만 담아 시간·가중치·사회적 가치를 한눈에 보여 주고, 확인번호로 진위를 증명합니다.',
    cta: { label: '봉사 이력서 알아보기', to: '/me/resume' },
  },
  {
    image: '/images/care.png',
    alt: '어르신과 마주 앉아 이야기를 나누는 청년 봉사자',
    eyebrow: '기관을 위한 ESG 경영 보고서',
    title: ['우리 기관의 봉사 성과를', '숫자로 보고하세요'],
    highlight: '숫자로',
    desc: '봉사 모집부터 기록 승인, 사회적 가치 집계와 ESG 경영 보고서 발행까지 한 곳에서 처리합니다.',
    cta: { label: '기관 서비스 시작하기', to: '/org' },
  },
];

const INTERVAL = 6000;

/** 메인 배너 — 화면 너비 가득, 3장 자동 전환 (마우스를 올리거나 일시정지하면 멈춤) */
export function HeroBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<number>();
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((n: number) => setIndex((n + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused || hover || reduced) return;
    timer.current = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => {
      window.clearTimeout(timer.current);
    };
  }, [index, paused, hover, reduced, go]);

  return (
    <section
      className="banner"
      aria-roledescription="carousel"
      aria-label="GreenStep 소개 배너"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false);
      }}
    >
      {SLIDES.map((s, i) => {
        const active = i === index;
        const [before, after] = s.title[1].split(s.highlight);
        return (
          <div key={s.image} className={`banner-slide${active ? ' active' : ''}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${SLIDES.length}`} aria-hidden={!active}>
            <img className="banner-photo" src={s.image} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="banner-shade" aria-hidden="true" />
            <div className="container banner-content">
              <p className="banner-eyebrow">
                <Icon name="shield" />
                {s.eyebrow}
              </p>
              {i === 0 ? (
                <h1 className="banner-title">
                  {s.title[0]}
                  <br />
                  {before}
                  <span className="highlight">{s.highlight}</span>
                  {after}
                </h1>
              ) : (
                <h2 className="banner-title">
                  {s.title[0]}
                  <br />
                  {before}
                  <span className="highlight">{s.highlight}</span>
                  {after}
                </h2>
              )}
              <p className="banner-desc">{s.desc}</p>
              <Link className="banner-cta" to={s.cta.to} tabIndex={active ? 0 : -1}>
                {s.cta.label}
                <Icon name="arrow" />
              </Link>
              {s.steps && (
                <div className="banner-steps" aria-label={s.steps.join(', ') + ' 순서'}>
                  {s.steps.map((st, k) => (
                    <span key={st} className="inline-flex items-center gap-3">
                      {k > 0 && <Icon name="arrow" small />}
                      {st}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="container banner-controls-wrap">
        <div className="banner-controls">
          <div className="banner-pager">
            <button type="button" onClick={() => go(index - 1)} aria-label="이전 배너">
              <Icon name="prev" small />
            </button>
            <span aria-live="polite">
              <strong>{index + 1}</strong> / {SLIDES.length}
            </span>
            <button type="button" onClick={() => go(index + 1)} aria-label="다음 배너">
              <Icon name="next" small />
            </button>
          </div>
          <button type="button" className="banner-pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? '자동 전환 재생' : '자동 전환 일시정지'}>
            <Icon name={paused ? 'play' : 'pause'} small />
          </button>
          <div className="banner-dots">
            {SLIDES.map((s, i) => (
              <button key={s.image} type="button" aria-label={`${i + 1}번째 배너 보기`} aria-current={i === index} onClick={() => go(i)}>
                <i style={i === index && !paused && !hover && !reduced ? { animationDuration: `${INTERVAL}ms` } : undefined} className={i === index ? 'on' : ''} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
