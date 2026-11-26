import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** 원본 시안의 <dialog> 스타일을 그대로 쓰는 모달 */
export function Dialog({ open, title, onClose, children, actions, className }: { open: boolean; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="닫기">
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{actions ?? <button className="button" onClick={onClose}>확인</button>}</div>
    </dialog>
  );
}
