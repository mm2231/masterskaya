/** Блок условий выполнения работ — печатается в обоих актах. */

import { REPAIR_TERMS, REPAIR_TERMS_TITLE } from '@masterskaya/shared';

export function PrintTerms() {
  return (
    <div className="print-terms">
      <div className="print-terms-title">{REPAIR_TERMS_TITLE}</div>
      <ol>
        {REPAIR_TERMS.map((term) => (
          <li key={term.slice(0, 24)}>{term}</li>
        ))}
      </ol>
    </div>
  );
}
