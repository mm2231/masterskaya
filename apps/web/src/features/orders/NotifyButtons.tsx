/** Кнопки уведомления клиента: SMS, Telegram, Viber. */

import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api';

interface NotifyData {
  text: string;
  links: { sms: string; telegram: string; viber: string };
}

export function NotifyButtons({ orderId }: { orderId: number }) {
  const notify = useQuery({
    queryKey: ['notify', orderId],
    queryFn: () => api.get<NotifyData>(`/api/notify/ready/${orderId}`),
    enabled: false,
  });

  // Загружаем ссылки по нажатию — чтобы не обращаться к серверу зря.
  const load = () => {
    if (!notify.data) void notify.refetch();
  };

  const links = notify.data?.links;

  return (
    <div className="btn-row">
      <button type="button" className="btn sm" onClick={load} disabled={notify.isFetching}>
        Напомнить клиенту
      </button>
      {links?.sms ? (
        <a className="btn sm ghost" href={links.sms} title={notify.data?.text}>
          SMS
        </a>
      ) : null}
      {links?.telegram ? (
        <a className="btn sm ghost" href={links.telegram} title={notify.data?.text}>
          Telegram
        </a>
      ) : null}
      {links?.viber ? (
        <a className="btn sm ghost" href={links.viber} title={notify.data?.text}>
          Viber
        </a>
      ) : null}
    </div>
  );
}
