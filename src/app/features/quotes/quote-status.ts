import { QuoteStatus } from '../../core/models';

export const QUOTE_STATUS_CLASS: Record<QuoteStatus, string> = {
  draft: '',
  sent: 'info',
  viewed: 'gold',
  accepted: 'success',
  declined: 'danger',
  expired: '',
};

export const QUOTE_EVENT_ICON: Record<string, string> = {
  created: 'edit',
  sent: 'send',
  resent: 'send',
  viewed: 'eye',
  accepted: 'check',
  marked_accepted: 'check',
  declined: 'x',
  marked_declined: 'x',
  expired: 'clock',
  follow_up: 'bell',
};
