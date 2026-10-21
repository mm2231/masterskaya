import { describe, expect, it } from 'vitest';

import { normalizeNumber, notifyLinks, readyMessage } from './notify.js';

describe('normalizeNumber', () => {
  it('добавляет код 375 к белорусскому номеру', () => {
    expect(normalizeNumber('29 123-45-67')).toBe('375291234567');
  });

  it('сохраняет полный номер', () => {
    expect(normalizeNumber('+375291234567')).toBe('375291234567');
  });

  it('пустой номер — пустая строка', () => {
    expect(normalizeNumber(null)).toBe('');
  });
});

describe('readyMessage', () => {
  it('здоровается по имени и упоминает мастерскую', () => {
    const text = readyMessage({
      clientName: 'Иванов',
      device: 'Redmi Note 9',
      workshopName: 'Мобилдок',
      address: 'ул. Аскаленко, 7',
      phone: '+375295354791',
    });
    expect(text).toContain('Здравствуйте, Иванов!');
    expect(text).toContain('Redmi Note 9 готов к выдаче');
    expect(text).toContain('Мобилдок');
    expect(text).toContain('+375295354791');
  });

  it('работает без имени клиента', () => {
    const text = readyMessage({ workshopName: 'Мобилдок' });
    expect(text).toContain('Здравствуйте!');
    expect(text).toContain('Ваш телефон');
  });
});

describe('notifyLinks', () => {
  it('собирает ссылки для всех каналов', () => {
    const links = notifyLinks(
      { phone: '+375291234567' },
      'Ваш телефон готов',
    );
    expect(links.sms).toContain('sms:+375291234567');
    expect(links.sms).toContain('body=');
    expect(links.telegram).toBe('https://t.me/+375291234567');
    expect(links.viber).toBe('viber://chat?number=%2B375291234567');
  });

  it('без телефона ссылки пустые', () => {
    const links = notifyLinks({}, 'текст');
    expect(links.sms).toBe('');
    expect(links.telegram).toBe('');
    expect(links.viber).toBe('');
  });
});
