import { describe, expect, it } from 'vitest';

import { REPAIR_TERMS, REPAIR_TERMS_TITLE } from './terms.js';

describe('условия выполнения работ', () => {
  it('содержит все шесть пунктов', () => {
    expect(REPAIR_TERMS).toHaveLength(6);
  });

  it('пункт о стоимости говорит, что она определяется после диагностики', () => {
    expect(REPAIR_TERMS[0]).toContain('после диагностики');
    expect(REPAIR_TERMS[0]).toContain('согласовывается до начала работ');
  });

  it('упоминает ответственность за данные и SIM-карты', () => {
    expect(REPAIR_TERMS[1]).toContain('данных');
    expect(REPAIR_TERMS[1]).toContain('SIM-карт');
  });

  it('упоминает скрытые дефекты', () => {
    expect(REPAIR_TERMS[2]).toContain('без полного разбора');
    expect(REPAIR_TERMS[2]).toContain('срок ремонта');
  });

  it('оговаривает исключения из гарантии', () => {
    expect(REPAIR_TERMS[3]).toContain('Гарантия не действует');
    expect(REPAIR_TERMS[3]).toContain('третьими лицами');
  });

  it('допускает аналоговые и б/у запчасти по согласованию', () => {
    expect(REPAIR_TERMS[4]).toContain('аналоговых');
    expect(REPAIR_TERMS[4]).toContain('бывших в употреблении');
  });

  it('устанавливает срок хранения 60 дней', () => {
    expect(REPAIR_TERMS[5]).toContain('60 дней');
  });

  it('имеет заголовок', () => {
    expect(REPAIR_TERMS_TITLE.length).toBeGreaterThan(0);
  });
});
