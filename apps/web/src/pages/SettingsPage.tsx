/** Настройки: реквизиты мастерской и шаблоны нумерации. */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import type { UpdateStatus, Workshop } from '../lib/types';

export function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const workshop = useQuery({
    queryKey: ['workshop'],
    queryFn: () => api.get<{ workshop: Workshop }>('/api/settings/workshop'),
  });

  const numbering = useQuery({
    queryKey: ['numbering'],
    queryFn: () =>
      api.get<{ orderNumberPattern: string; documentNumberPattern: string }>(
        '/api/settings/numbering',
      ),
  });

  const [form, setForm] = useState<Workshop>({
    name: '',
    owner: '',
    unp: '',
    address: '',
    phone: '',
  });
  const [orderPattern, setOrderPattern] = useState('{YYYY}-{SEQ}');
  const [docPattern, setDocPattern] = useState('{YYYY}-{SEQ}');

  /** Проверка обновлений на GitHub. */
  const update = useQuery({
    queryKey: ['update'],
    queryFn: () => api.get<UpdateStatus>('/api/settings/update'),
    retry: false,
  });

  /** Установка обновления — приложение перезапустится само. */
  const install = useMutation({
    mutationFn: () => api.post<{ message: string }>('/api/settings/update'),
    onSuccess: (data) => {
      toast.show(data.message, 'success');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  useEffect(() => {
    if (workshop.data) setForm(workshop.data.workshop);
  }, [workshop.data]);

  useEffect(() => {
    if (numbering.data) {
      setOrderPattern(numbering.data.orderNumberPattern);
      setDocPattern(numbering.data.documentNumberPattern);
    }
  }, [numbering.data]);

  const saveWorkshop = useMutation({
    mutationFn: (value: Workshop) => api.put('/api/settings/workshop', value),
    onSuccess: () => {
      toast.show('Реквизиты сохранены', 'success');
      void queryClient.invalidateQueries({ queryKey: ['workshop'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const saveNumbering = useMutation({
    mutationFn: (value: { orderNumberPattern: string; documentNumberPattern: string }) =>
      api.put('/api/settings/numbering', value),
    onSuccess: () => {
      toast.show('Шаблоны нумерации сохранены', 'success');
      void queryClient.invalidateQueries({ queryKey: ['numbering'] });
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  return (
    <>
      <div className="page-head">
        <h1>Настройки</h1>
      </div>

      <div className="split-even">
        <section className="panel">
          <div className="panel-head">Реквизиты мастерской</div>
          <div className="panel-body">
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              Эти данные подставляются в приёмный акт и акт выполненных работ.
            </p>
            <label className="field">
              <span className="field-label">Название</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Владелец</span>
              <input
                value={form.owner}
                onChange={(event) => setForm({ ...form, owner: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">УНП</span>
              <input
                value={form.unp}
                onChange={(event) => setForm({ ...form, unp: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Адрес</span>
              <input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Телефон</span>
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="btn primary"
                disabled={saveWorkshop.isPending}
                onClick={() => saveWorkshop.mutate(form)}
              >
                Сохранить
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">Нумерация документов</div>
          <div className="panel-body">
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              Подстановки: <code>{'{YYYY}'}</code> — год, <code>{'{SEQ}'}</code> — порядковый
              номер.
            </p>
            <label className="field">
              <span className="field-label">Номер заказа</span>
              <input
                value={orderPattern}
                onChange={(event) => setOrderPattern(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Номер акта</span>
              <input value={docPattern} onChange={(event) => setDocPattern(event.target.value)} />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="btn primary"
                disabled={saveNumbering.isPending}
                onClick={() =>
                  saveNumbering.mutate({
                    orderNumberPattern: orderPattern,
                    documentNumberPattern: docPattern,
                  })
                }
              >
                Сохранить
              </button>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">Обновление приложения</div>
          <div className="panel-body">
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              Приложение обновляется напрямую с GitHub. База данных при этом не
              затрагивается — обновляется только код.
            </p>

            {update.data ? (
              <div style={{ marginBottom: 14 }}>
                <div>
                  <strong>Установленная версия:</strong>{' '}
                  <code>{update.data.current?.short ?? '—'}</code>{' '}
                  {update.data.current?.subject ?? ''}
                </div>
                {update.data.current?.date ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    от {update.data.current.date.slice(0, 10)}
                  </div>
                ) : null}
                <div style={{ marginTop: 6 }}>
                  {update.data.available ? (
                    <span style={{ color: 'var(--accent)' }}>
                      Доступно обновлений: {update.data.remote?.behind ?? 0}
                      {update.data.remote?.subject
                        ? ` — ${update.data.remote.subject}`
                        : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {update.data.reason ?? 'Установлена последняя версия'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                {update.isPending ? 'Проверяю обновления…' : 'Нажмите «Проверить», чтобы узнать о новых версиях.'}
              </p>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={update.isPending}
                onClick={() => void update.refetch()}
              >
                Проверить обновления
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={install.isPending || !update.data?.available}
                onClick={() => install.mutate()}
              >
                {install.isPending ? 'Обновляю…' : 'Установить и перезапустить'}
              </button>
            </div>
            {update.data?.available ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 0 }}>
                После установки приложение перезапустится, а страница откроется
                заново.
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">Резервная копия данных</div>
          <div className="panel-body">
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              Выгрузите все данные в JSON-файл — его можно сохранить на флешку или
              перенести на другой компьютер. Импорт не создаёт дубликаты: клиенты
              сверяются по телефону, заказы — по номеру.
            </p>
            <a className="btn" href="/api/settings/export">
              ⬇ Скачать все данные (JSON)
            </a>
            <label className="field" style={{ marginTop: 14 }}>
              <span className="field-label">Загрузить файл с данными</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const payload = JSON.parse(await file.text());
                    const response = await api.post<{ report: Record<string, number> }>(
                      '/api/settings/import',
                      payload,
                    );
                    const report = response.report;
                    toast.show(
                      `Загружено: клиентов ${report.clients}, заказов ${report.orders}`,
                      'success',
                    );
                    void queryClient.invalidateQueries();
                  } catch (error) {
                    toast.show(
                      error instanceof Error ? error.message : 'Не удалось загрузить файл',
                      'error',
                    );
                  }
                }}
              />
            </label>
          </div>
        </section>
      </div>
    </>
  );
}
