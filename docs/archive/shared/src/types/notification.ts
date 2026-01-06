export type NotificationChannel = 'email' | 'sms';

export type NotificationTrigger =
  | 'order_placed'
  | 'order_modified'
  | 'order_canceled'
  | 'cutoff_approaching'
  | 'bake_day_summary'
  | 'ready_for_pickup'
  | 'manual_broadcast';

export type AdminAlertFrequency = 'instant' | 'digest' | 'off';

export interface NotificationConfig {
  trigger: NotificationTrigger;
  enabled: boolean;

  // Customer notifications
  customerEmail: boolean;
  customerSms: boolean;
  customerTemplate: string;

  // Admin notifications
  adminEmail: boolean;
  adminSms: boolean;
  adminFrequency: AdminAlertFrequency;
  adminTemplate: string;
}

export interface NotificationLog {
  id: string;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  recipientType: 'customer' | 'admin';
  recipientId: string;
  recipientContact: string; // email or phone
  subject: string | null;
  body: string;
  status: 'sent' | 'failed' | 'pending';
  errorMessage: string | null;
  sentAt: string;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}
