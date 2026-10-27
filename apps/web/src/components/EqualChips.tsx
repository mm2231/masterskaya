/**
 * Ряд равных чипов-фильтров статусов.
 *
 * Ширина всех плиток -- самая длинная подпись в ряду (замеряется
 * по метрикам шрифта, без layout-дёргания), но не уже 148px и не
 * шире 176px. Если подпись не влезает даже в потолок — шрифт ряда
 * немного уменьшается, чтобы текст влез целиком: обрезка и «рваные»
 * края недопустимы.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Диапазон разумной ширины плитки. */
const MIN_CHIP = 148;
const MAX_CHIP = 176;
/** Отступ: padding 0 var(--space-3) + рамка. */
const HORIZONTALS = 26;

export function EqualChips({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const chips = Array.from(box.querySelectorAll<HTMLElement>('.chip'));
    if (chips.length === 0) return;

    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;

    const first = chips[0];
    if (!first) return;
    const style = getComputedStyle(first);
    // Canvas-шрифт: «вес размер семейство». Массив запасных семейств
    // допустим — measureText берёт первое доступное.
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    // Подбираем масштаб шрифта: 1 → 0.92 → 0.85 → 0.78, пока самый
    // длинный текст уложится в потолок ширины.
    let widest = 0;
    for (const chip of chips) {
      const text = chip.textContent ?? '';
      const w = ctx.measureText(text).width;
      if (w > widest) widest = w;
    }
    let scale = 1;
    for (const candidate of [1, 0.92, 0.85, 0.78]) {
      scale = candidate;
      if (widest * candidate + HORIZONTALS <= MAX_CHIP) break;
    }

    const px = parseFloat(style.fontSize);
    const width = Math.max(
      MIN_CHIP,
      Math.min(MAX_CHIP, Math.ceil(widest * scale + HORIZONTALS)),
    );

    box.style.setProperty('--chip-w', `${width}px`);
    box.style.setProperty('--chip-fs', `${Math.round(px * scale * 10) / 10}px`);
  });

  return (
    <div className="chips chip-equal" ref={ref}>
      {children}
    </div>
  );
}
