import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';

/**
 * 홈 "함께한 시간은 얼마의 가치가 될까요?" 영역의 문서 디자인 목업 보기 창.
 * 목업 파일은 web/public/mockups/ — 디자인 원본은 레포의 mokup/ 폴더(봉사 이력서 HTML, ESG 경영 보고서 A·B·C안 PDF).
 * 수치는 public/mockups/greenstep-data.js 의 DB 테이블 형태 예시 데이터에서 집계합니다.
 * 보기 전용이라 인쇄·다운로드 기능은 두지 않습니다.
 */
export type MockupKind = 'resume' | 'report';

const REPORT_VARIANTS = [
  { key: 'a', label: 'A안', name: 'Ocean Corporate' },
  { key: 'b', label: 'B안', name: 'Editorial Mono' },
  { key: 'c', label: 'C안', name: 'Swiss Grid' },
] as const;

export function DocMockupDialog({ kind, onClose }: { kind: MockupKind | null; onClose: () => void }) {
  const [variant, setVariant] = useState<(typeof REPORT_VARIANTS)[number]['key']>('a');

  useEffect(() => {
    if (kind) setVariant('a');
  }, [kind]);

  const isReport = kind === 'report';
  const src = isReport ? `/mockups/report-${variant}.html` : '/mockups/resume.html';
  const current = REPORT_VARIANTS.find((v) => v.key === variant)!;

  return (
    <Dialog
      open={kind !== null}
      className="doc-mockup"
      title={isReport ? '기관을 위한 ESG 경영 보고서 · 디자인 목업' : '청년을 위한 봉사 이력서 · 디자인 목업'}
      onClose={onClose}
      actions={<button className="button" onClick={onClose}>닫기</button>}
    >
      <div className="doc-mockup-bar">
        <p className="text-[15px]">
          {isReport
            ? `성남 이웃돌봄복지관의 2026년 활동 기록으로 만든 예시 보고서입니다. (${current.label} · ${current.name})`
            : '김지원 청년의 기관 승인 기록으로 만든 예시 이력서입니다. (A4 2매)'}
          <span className="text-muted"> 수치는 DB 테이블 구조에 맞춘 임의의 예시 데이터입니다.</span>
        </p>
        {isReport && (
          <div className="seg" role="group" aria-label="보고서 디자인 안">
            {REPORT_VARIANTS.map((v) => (
              <button key={v.key} type="button" aria-pressed={variant === v.key} onClick={() => setVariant(v.key)} title={v.name}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {kind && <iframe key={src} className="doc-mockup-frame" src={src} title={isReport ? `ESG 경영 보고서 ${current.label} 목업` : '봉사 이력서 목업'} loading="lazy" />}
    </Dialog>
  );
}
