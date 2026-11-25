import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { VerifyResult } from '../data/types';
import { SubPage } from '../components/SubPage';
import { Icon } from '../components/Icon';
import { errorMessage } from '../lib/useAsync';
import { dateDot, num, won } from '../lib/format';

/** 확인번호 진위 조회 (QR 없음). 기관명·연도·총 가치·발행일만 표시 */
export default function Verify() {
  const [params] = useSearchParams();
  const [no, setNo] = useState(params.get('no') ?? '');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!/^GSR?-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/i.test(no.trim())) {
      setError('확인번호 형식을 확인해 주세요. 예) GS-2025-0002-7K3Q');
      return;
    }
    setBusy(true);
    try {
      setResult(await api.verify.lookup(no.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SubPage section="support" title="확인번호 조회" desc="GreenStep이 발행한 ESG 경영 보고서와 봉사 이력서의 진위를 확인합니다.">
      <div className="mx-auto max-w-[720px]">
        <form className="panel" onSubmit={submit}>
          <div className="field">
            <label htmlFor="v-no">확인번호</label>
            <div className="flex gap-3">
              <input id="v-no" value={no} onChange={(e) => setNo(e.target.value.toUpperCase())} placeholder="GS-2025-0002-7K3Q" autoComplete="off" />
              <button className="button primary" style={{ minHeight: 48, minWidth: 120 }} disabled={busy}>
                <Icon name="search" />
                조회
              </button>
            </div>
            <p className="help">보고서는 GS-연도-기관번호-코드, 이력서는 GSR-연도-번호-코드 형식입니다. 시연용 예시: GS-2025-0002-7K3Q</p>
          </div>
        </form>
        {error && <p className="form-error mt-4">{error}</p>}
        {result && (
          <div className="panel mt-4" style={{ borderColor: '#c2dac6' }}>
            <div className="flex items-center gap-3">
              <span className="caption-check">
                <Icon name="check" />
              </span>
              <div>
                <p className="font-bold text-green">GreenStep에서 발행한 {result.kind === 'CSR' ? 'ESG 경영 보고서' : '봉사 이력서'}가 맞습니다.</p>
                <p className="text-[14px] text-muted">{result.confirmNo}</p>
              </div>
            </div>
            <dl className="detail-list">
              <div><dt>{result.kind === 'CSR' ? '기관명' : '발급 대상'}</dt><dd>{result.title}</dd></div>
              <div><dt>{result.kind === 'CSR' ? '보고 연도' : '발급 연도'}</dt><dd>{result.year}년{result.version && result.version > 1 ? ` (버전 ${result.version})` : ''}</dd></div>
              <div><dt>총 사회적 가치</dt><dd>{won(result.totalValue)}원</dd></div>
              <div><dt>총 활동 시간</dt><dd>{num(result.totalHours)}시간</dd></div>
              <div><dt>발행일</dt><dd>{dateDot(result.issuedAt)}</dd></div>
            </dl>
            <p className="text-[13px] text-muted">발행 시점의 집계 스냅샷 기준입니다. 이후 승인된 기록은 반영되지 않습니다.</p>
          </div>
        )}
      </div>
    </SubPage>
  );
}
